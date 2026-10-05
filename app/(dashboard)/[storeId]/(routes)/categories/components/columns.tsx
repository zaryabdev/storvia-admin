"use client"

import { ColumnDef } from "@tanstack/react-table"

import { CATEGORY_ICONS, isCategoryIconKey } from "@/lib/category-icons"

import { CellAction } from "./cell-action"

export type CategoryColumn = {
  id: string
  name: string;
  iconKey: string | null;
  parentName: string;
  billboardLabel: string;
  createdAt: string;
}

export const columns: ColumnDef<CategoryColumn>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const iconKey = row.original.iconKey;
      const Icon = isCategoryIconKey(iconKey) ? CATEGORY_ICONS[iconKey].icon : null;

      return (
        <span className="inline-flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {row.original.name}
        </span>
      );
    },
  },
  {
    accessorKey: "parent",
    header: "Parent",
    cell: ({ row }) => row.original.parentName,
  },
  {
    accessorKey: "billboard",
    header: "Billboard",
    cell: ({ row }) => row.original.billboardLabel,
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
