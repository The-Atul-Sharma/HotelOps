import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { PaginationBar } from "@/components/shared/Pagination";
import { useAuditLog } from "@/hooks/useEntities";
import { useDateRange } from "@/hooks/useDateRange";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagination } from "@/hooks/usePagination";
import { ENTITY_AUDIT_LABELS } from "@/services/api";
import { inRange } from "@/utils/dateRange";
import { formatDateTime } from "@/utils/format";
import type { AuditLogEntry } from "@/types";

const ACTIONS: Array<AuditLogEntry["action"] | "ALL"> = [
  "ALL",
  "create",
  "update",
  "delete",
  "void",
];

const ENTITY_OPTIONS = [...new Set(Object.values(ENTITY_AUDIT_LABELS))].sort();

function formatAuditChange(a: AuditLogEntry): string {
  if (!a.field) return "—";
  if (a.oldValue != null && a.newValue != null) {
    return `${a.field}: ${a.oldValue} → ${a.newValue}`;
  }
  if (a.newValue != null) return `${a.field}: ${a.newValue}`;
  return a.field;
}

export function AuditLogSection() {
  const { data: audit = [], isLoading } = useAuditLog();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 250);
  const [actionFilter, setActionFilter] = useState<
    AuditLogEntry["action"] | "ALL"
  >("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const { range, resetKey, filterProps } = useDateRange("month");

  const users = useMemo(
    () => [...new Set(audit.map((a) => a.user))].sort(),
    [audit],
  );

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return audit.filter((a) => {
      if (!inRange(a.timestamp, range)) return false;
      if (actionFilter !== "ALL" && a.action !== actionFilter) return false;
      if (entityFilter !== "ALL" && a.entity !== entityFilter) return false;
      if (userFilter !== "ALL" && a.user !== userFilter) return false;
      if (!q) return true;
      const hay = [
        a.user,
        a.action,
        a.entity,
        a.entityId,
        a.field,
        a.oldValue,
        a.newValue,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [audit, range, actionFilter, entityFilter, userFilter, debounced]);

  const pageResetKey = `${resetKey}|${actionFilter}|${entityFilter}|${userFilter}|${debounced}`;
  const { page, setPage, pageItems, total } = usePagination(
    filtered,
    pageResetKey,
  );

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="text-base">Audit Log</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, entity, change…"
              className="pl-8"
            />
          </div>
          <Select
            value={actionFilter}
            onValueChange={(v) =>
              setActionFilter(v as AuditLogEntry["action"] | "ALL")
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "ALL" ? "All actions" : a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All entities</SelectItem>
              {ENTITY_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter {...filterProps} />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description="Try adjusting filters, or make a change in the app to generate a log."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(a.timestamp)}
                      </TableCell>
                      <TableCell>{a.user}</TableCell>
                      <TableCell className="capitalize">{a.action}</TableCell>
                      <TableCell>
                        {a.entity} #{a.entityId}
                      </TableCell>
                      <TableCell className="max-w-[420px] text-sm wrap-break-word">
                        {formatAuditChange(a)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar page={page} total={total} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
