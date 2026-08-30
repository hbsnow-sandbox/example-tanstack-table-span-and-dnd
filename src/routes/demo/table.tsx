import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FlexRender,
  columnOrderingFeature,
  columnSizingFeature,
  createTableHook,
  columnVisibilityFeature,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { makeData } from "#/data/demo-table-data";

import type { CSSProperties } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Header } from "@tanstack/react-table";
import type { Person } from "#/data/demo-table-data";

export const Route = createFileRoute("/demo/table")({
  component: TableDemo,
});

const { appFeatures, useAppTable, createAppColumnHelper } = createTableHook({
  features: { columnSizingFeature, columnOrderingFeature, columnVisibilityFeature },
});

type AppFeatures = typeof appFeatures;

const columnHelper = createAppColumnHelper<Person>();

const columns = columnHelper.columns([
  columnHelper.group({
    id: "name",
    header: "Name",
    columns: columnHelper.columns([
      columnHelper.accessor("firstName", {
        id: "firstName",
        header: "First Name",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor((row) => row.lastName, {
        id: "lastName",
        header: () => <span>Last Name</span>,
        cell: (info) => info.getValue(),
      }),
    ]),
  }),
  columnHelper.group({
    id: "stats",
    header: "Stats",
    columns: columnHelper.columns([
      columnHelper.accessor("age", { id: "age", header: "Age" }),
      columnHelper.accessor("visits", {
        id: "visits",
        header: () => <span>Visits</span>,
      }),
    ]),
  }),
  columnHelper.group({
    id: "profile",
    header: "Profile",
    columns: columnHelper.columns([
      columnHelper.accessor("status", { id: "status", header: "Status" }),
      columnHelper.accessor("progress", {
        id: "progress",
        header: "Profile Progress",
      }),
    ]),
  }),
]);

/**
 * ドラッグ可能なグループヘッダー
 */
function DraggableGroupHeader({ header }: { header: Header<AppFeatures, Person, unknown> }) {
  const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable({
    id: header.column.id,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
    cursor: "grab",
    whiteSpace: "nowrap",
  };

  return (
    <th ref={setNodeRef} colSpan={header.colSpan} style={style} {...attributes} {...listeners}>
      <FlexRender header={header} /> ↔
    </th>
  );
}

/**
 * ページ
 */
function TableDemo() {
  const [data, setData] = React.useState(() => makeData(20));

  const table = useAppTable({ columns, data, getRowId: (row) => row.userId }, (state) => state);

  // noUncheckedIndexedAccess でも通るようにガードする
  const topHeaders = table.getHeaderGroups()[0]?.headers ?? [];

  const groupIds = React.useMemo(
    () =>
      topHeaders.filter((h) => !h.isPlaceholder && h.subHeaders.length > 0).map((h) => h.column.id),
    [topHeaders],
  );

  function handleColumnDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const blocks = topHeaders.map((h) => ({
      id: h.column.id,
      leaves: h.column.getLeafColumns().map((c) => c.id),
    }));
    const from = blocks.findIndex((b) => b.id === String(active.id));
    const to = blocks.findIndex((b) => b.id === String(over.id));
    if (from < 0 || to < 0) return;

    // ブロック単位で入れ替えてから leaf に展開する
    table.setColumnOrder(arrayMove(blocks, from, to).flatMap((b) => b.leaves));
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleColumnDragEnd}
      sensors={sensors}
    >
      <div className="demo-root">
        <button type="button" onClick={() => setData(makeData(20))}>
          Regenerate Data
        </button>

        <table>
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup, depth) => (
              <tr key={headerGroup.id}>
                <SortableContext items={groupIds} strategy={horizontalListSortingStrategy}>
                  {headerGroup.headers.map((header) => {
                    const draggable =
                      depth === 0 && !header.isPlaceholder && header.subHeaders.length > 0;

                    return draggable ? (
                      <DraggableGroupHeader key={header.id} header={header} />
                    ) : (
                      <th key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : <FlexRender header={header} />}
                      </th>
                    );
                  })}
                </SortableContext>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    <FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}
