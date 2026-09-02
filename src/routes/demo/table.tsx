import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FlexRender,
  columnOrderingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createTableHook,
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

import type { CSSProperties, ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Person } from "#/data/demo-table-data";

export const Route = createFileRoute("/demo/table")({
  component: TableDemo,
});

const { useAppTable, createAppColumnHelper } = createTableHook({
  features: {
    columnSizingFeature,
    columnOrderingFeature,
    columnVisibilityFeature,
  },
});

const columnHelper = createAppColumnHelper<Person>();

// ヘッダーは文字列だけにしておく（自前で描画するため）
const columns = columnHelper.columns([
  columnHelper.display({
    id: "index",
    header: "#",
    size: 48,
    cell: ({ row }) => row.index + 1,
  }),
  columnHelper.accessor("userId", {
    id: "userId",
    header: "ID",
    size: 90,
    cell: (info) => String(info.getValue()).slice(0, 6),
  }),
  columnHelper.accessor("status", {
    id: "status",
    header: "Status",
    size: 130,
    cell: (info) => info.getValue(),
  }),
  columnHelper.group({
    id: "name",
    header: "Name",
    columns: columnHelper.columns([
      columnHelper.accessor("firstName", {
        id: "firstName",
        header: "First Name",
        size: 140,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor((row) => row.lastName, {
        id: "lastName",
        header: "Last Name",
        size: 140,
        cell: (info) => info.getValue(),
      }),
    ]),
  }),
  columnHelper.group({
    id: "stats",
    header: "Stats",
    columns: columnHelper.columns([
      columnHelper.accessor("age", {
        id: "age",
        header: "Age",
        size: 70,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("visits", {
        id: "visits",
        header: "Visits",
        size: 90,
        cell: (info) => info.getValue(),
      }),
    ]),
  }),
  columnHelper.group({
    id: "profile",
    header: "Profile",
    columns: columnHelper.columns([
      columnHelper.accessor("progress", {
        id: "progress",
        header: "Profile Progress",
        size: 160,
        cell: (info) => `${info.getValue()}%`,
      }),
    ]),
  }),
]);

const thStyle: CSSProperties = {
  border: "1px solid #ccc",
  padding: "6px 10px",
  background: "#f6f7f9",
  fontWeight: 600,
};

function DraggableTh({
  id,
  label,
  colSpan,
  rowSpan,
  align,
}: {
  id: string;
  label: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  align: "left" | "center";
}) {
  const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable({
    id,
  });

  const style: CSSProperties = {
    ...thStyle,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
    textAlign: align,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    cursor: "grab",
    touchAction: "none",
    background: isDragging ? "#e6efff" : thStyle.background,
  };

  return (
    <th
      ref={setNodeRef}
      colSpan={colSpan}
      rowSpan={rowSpan}
      style={style}
      {...attributes}
      {...listeners}
    >
      {label}
      <span aria-hidden style={{ opacity: 0.35, marginLeft: 6 }}>
        ↔
      </span>
    </th>
  );
}

function TableDemo() {
  const [data, setData] = React.useState(() => makeData(20));

  const table = useAppTable({ columns, data, getRowId: (row) => row.userId }, (state) => state);

  const leafColumns = table.getVisibleLeafColumns();

  /**
   * 表示順のまま「トップレベル列」を 1 ブロックとして取り出す。
   * - 単独列   → leaves は自分 1 つ
   * - グループ → leaves は配下の leaf 全部
   * getHeaderGroups() を使わないので placeholder の扱いが一切不要。
   */
  const blocks = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      label: ReactNode;
      isGroup: boolean;
      leaves: typeof leafColumns;
    }> = [];

    for (const leaf of leafColumns) {
      let top = leaf;
      while (top.parent) top = top.parent;
      if (seen.has(top.id)) continue;
      seen.add(top.id);

      const isGroup = (top.columns?.length ?? 0) > 0;
      result.push({
        id: top.id,
        label: top.columnDef.header as ReactNode,
        isGroup,
        leaves: isGroup ? top.getLeafColumns() : [top],
      });
    }
    return result;
  }, [leafColumns]);

  const blockIds = blocks.map((b) => b.id);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const from = blockIds.indexOf(String(active.id));
    const to = blockIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    // 単独列 ⇄ グループ の入れ替えを禁止する（領域を保つ）
    if (blocks[from]!.isGroup !== blocks[to]!.isGroup) return;

    // ブロック単位で入れ替えて leaf に展開するだけ
    table.setColumnOrder(arrayMove(blocks, from, to).flatMap((b) => b.leaves.map((c) => c.id)));
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
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => setData(makeData(20))}>
            Regenerate Data
          </button>
          <button type="button" onClick={() => table.setColumnOrder([])}>
            Reset Order
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>ヘッダー上段をドラッグして並べ替え</span>
        </div>

        <table style={{ borderCollapse: "collapse" }}>
          <colgroup>
            {leafColumns.map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>

          <thead>
            {/* 上段: ブロックを 1 セルずつ。単独列は rowSpan=2 で貫通 */}
            <tr>
              <SortableContext items={blockIds} strategy={horizontalListSortingStrategy}>
                {blocks.map((block) => (
                  <DraggableTh
                    key={block.id}
                    id={block.id}
                    label={block.label}
                    colSpan={block.isGroup ? block.leaves.length : undefined}
                    rowSpan={block.isGroup ? undefined : 2}
                    align={block.isGroup ? "center" : "left"}
                  />
                ))}
              </SortableContext>
            </tr>

            {/* 下段: グループ配下の leaf のみ */}
            <tr>
              {blocks
                .filter((block) => block.isGroup)
                .flatMap((block) =>
                  block.leaves.map((col) => (
                    <th key={col.id} style={{ ...thStyle, textAlign: "left" }}>
                      {col.columnDef.header as ReactNode}
                    </th>
                  )),
                )}
            </tr>
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ border: "1px solid #e5e5e5", padding: "6px 10px" }}>
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
