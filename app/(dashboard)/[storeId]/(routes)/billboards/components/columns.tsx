"use client"

import { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"

import { CellAction } from "./cell-action"

export const LAYOUT_LABELS: Record<string, string> = {
  SPLIT: "Split",
  FULL_BLEED: "Full-bleed",
  HEADING_LED: "Heading-led",
};

export type BillboardColumn = {
  id: string
  label: string;
  layout: string;
  photoCount: number;
  createdAt: string;
  isHomepage: boolean;
}

export const columns: ColumnDef<BillboardColumn>[] = [
  {
    accessorKey: "label",
    header: "Label",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {row.original.label}
          {row.original.isHomepage && <Badge>Homepage</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.original.layout} · {row.original.photoCount} {row.original.photoCount === 1 ? "photo" : "photos"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Date",
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />
  },
];
