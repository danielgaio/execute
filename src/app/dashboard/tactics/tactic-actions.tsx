"use client";

import { IconButton, Tooltip } from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import Link from "next/link";
import { useTransition } from "react";
import { deleteTactic } from "./actions";

interface TacticActionsProps {
  tacticId: string;
  tacticTitle: string;
}

export default function TacticActions({ tacticId, tacticTitle }: TacticActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${tacticTitle}"? This will remove all associated history.`)) {
      startTransition(async () => {
        await deleteTactic(tacticId);
      });
    }
  };

  return (
    <>
      <Tooltip title="Edit Tactic">
        <Link href={`/dashboard/tactics/${tacticId}/edit`} passHref>
          <IconButton size="small" disabled={isPending}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Link>
      </Tooltip>
      <Tooltip title="Delete Tactic">
        <IconButton size="small" onClick={handleDelete} disabled={isPending} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );
}
