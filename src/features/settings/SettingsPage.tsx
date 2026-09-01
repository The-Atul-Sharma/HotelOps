import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  Users as UsersIcon,
  Trash2,
  Building2,
  BedDouble,
  ScrollText,
  Percent,
  Plus,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSettings,
  useUpdateSettings,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useRemoveUser,
} from "@/hooks/useEntities";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useCurrentUser, useIsAdmin } from "@/hooks/useCurrentUser";
import { settingsService } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { USER_ROLES } from "@/config/constants";
import { RoomsSettings } from "./RoomsSettings";
import { AuditLogSection } from "./AuditLogSection";
import type { HotelSettings, User, UserRole } from "@/types";

type SectionId = "hotel" | "rooms" | "tax" | "users" | "audit";

const ALL_SECTIONS: {
  id: SectionId;
  label: string;
  short: string;
  icon: LucideIcon;
  desc: string;
  adminOnly?: boolean;
}[] = [
  {
    id: "hotel",
    label: "Hotel",
    short: "Hotel",
    icon: Building2,
    desc: "Name, address & contact",
  },
  {
    id: "rooms",
    label: "Rooms",
    short: "Rooms",
    icon: BedDouble,
    desc: "Room numbers & floors",
  },
  {
    id: "tax",
    label: "Tax System",
    short: "Tax",
    icon: Percent,
    desc: "GST percentage",
  },
  {
    id: "users",
    label: "Users & Roles",
    short: "Users",
    icon: UsersIcon,
    desc: "Access control",
    adminOnly: true,
  },
  {
    id: "audit",
    label: "Audit Log",
    short: "Audit",
    icon: ScrollText,
    desc: "Change history",
  },
];

function parseSection(tab: string | null, allowed: SectionId[]): SectionId {
  if (tab && allowed.includes(tab as SectionId)) return tab as SectionId;
  return "hotel";
}

const emptyUserForm = {
  name: "",
  username: "",
  mobile: "",
  password: "",
  role: "Manager" as UserRole,
};

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: users = [] } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const removeUser = useRemoveUser();
  const update = useUpdateSettings();
  const confirm = useConfirm();
  const currentUser = useCurrentUser();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);

  const sections = ALL_SECTIONS.filter((s) => !s.adminOnly || isAdmin);
  const allowedIds = sections.map((s) => s.id);
  const section = parseSection(searchParams.get("tab"), allowedIds);
  const setSection = (id: SectionId) => {
    setSearchParams(id === "hotel" ? {} : { tab: id }, { replace: true });
  };

  const [form, setForm] = useState<HotelSettings | null>(null);
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "users" && !isAdmin) {
      setSearchParams({}, { replace: true });
    }
  }, [isAdmin, searchParams, setSearchParams]);

  if (isLoading || !form) return <LoadingState />;

  const set = (patch: Partial<HotelSettings>) => setForm({ ...form, ...patch });

  const save = () => {
    update.mutate(form, { onSuccess: () => toast.success("Settings saved") });
  };

  const resetData = async () => {
    const ok = await confirm({
      title: "Reset all data?",
      description:
        "Warning: This permanently deletes all bookings, payments, expenses, and settings in this browser, then restores the original sample data. This cannot be undone.",
      destructive: true,
      confirmText: "Reset everything",
    });
    if (ok) {
      await settingsService.reset();
      qc.invalidateQueries();
      toast.success("Data reset to sample data");
    }
  };

  const closeUserDialog = () => {
    setUserDialogOpen(false);
    setEditingUserId(null);
    setUserForm(emptyUserForm);
  };

  const openAddUser = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm);
    setUserDialogOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserForm({
      name: u.name,
      username: u.username,
      mobile: u.mobile,
      password: "",
      role: u.role,
    });
    setUserDialogOpen(true);
  };

  const deleteUser = async (u: User) => {
    if (u.username === currentUser.username || u.id === currentUser.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    if (
      u.role === "Admin" &&
      users.filter((x) => x.role === "Admin").length <= 1
    ) {
      toast.error("Cannot delete the last admin");
      return;
    }
    const ok = await confirm({
      title: `Delete ${u.name}?`,
      description: `Remove @${u.username}. This cannot be undone.`,
      destructive: true,
      confirmText: "Delete",
    });
    if (!ok) return;
    removeUser.mutate(u.id, {
      onSuccess: () => toast.success("User deleted"),
    });
  };

  const submitUser = (e: FormEvent) => {
    e.preventDefault();
    const name = userForm.name.trim();
    const username = userForm.username.trim().toLowerCase();
    const mobile = userForm.mobile.trim();
    const password = userForm.password;
    if (!name || !username || !mobile) {
      toast.error("Fill in name, username, and mobile");
      return;
    }
    if (!editingUserId && !password) {
      toast.error("Password is required for new users");
      return;
    }
    const usernameTaken = users.some(
      (u) =>
        u.username.toLowerCase() === username && u.id !== editingUserId,
    );
    if (usernameTaken) {
      toast.error("Username already exists");
      return;
    }

    if (editingUserId) {
      const existing = users.find((u) => u.id === editingUserId);
      if (
        existing?.role === "Admin" &&
        userForm.role !== "Admin" &&
        users.filter((x) => x.role === "Admin").length <= 1
      ) {
        toast.error("Cannot demote the last admin");
        return;
      }
      const patch: Partial<User> = {
        name,
        username,
        mobile,
        role: userForm.role,
      };
      if (password) patch.password = password;
      updateUser.mutate(
        { id: editingUserId, patch },
        {
          onSuccess: () => {
            toast.success("User updated");
            closeUserDialog();
          },
        },
      );
      return;
    }

    createUser.mutate(
      {
        name,
        username,
        mobile,
        password,
        role: userForm.role,
        active: true,
      },
      {
        onSuccess: () => {
          toast.success("User added");
          closeUserDialog();
        },
      },
    );
  };

  const active = sections.find((s) => s.id === section)!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Configure hotel details, rooms, users and more."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={resetData}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sm:inline">Reset Data</span>
              </Button>
            )}
            <Button onClick={save} className="gap-1.5">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      />

      <div className="space-y-3 lg:hidden">
        <Select
          value={section}
          onValueChange={(v) => setSection(v as SectionId)}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => {
            const Icon = s.icon;
            const selected = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
          <nav className="sticky top-4 space-y-1 rounded-xl border bg-card p-2">
            {sections.map((s) => {
              const Icon = s.icon;
              const selected = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px] leading-snug",
                        selected
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {s.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="hidden border-b pb-3 lg:block">
            <h2 className="text-lg font-semibold tracking-tight">
              {active.label}
            </h2>
            <p className="text-sm text-muted-foreground">{active.desc}</p>
          </div>

          {section === "hotel" && (
            <Card>
              <CardContent className="grid gap-4 m:grid-cols-2">
                <F label="Hotel Name">
                  <Input
                    value={form.hotelName}
                    onChange={(e) => set({ hotelName: e.target.value })}
                  />
                </F>
                <F label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                </F>
                <F label="Email">
                  <Input
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </F>
                <F label="Address" className="sm:col-span-2">
                  <Input
                    value={form.address}
                    onChange={(e) => set({ address: e.target.value })}
                  />
                </F>
                <F label="GST Number">
                  <Input
                    value={form.gstNumber}
                    onChange={(e) => set({ gstNumber: e.target.value })}
                  />
                </F>
              </CardContent>
            </Card>
          )}

          {section === "rooms" && <RoomsSettings />}

          {section === "tax" && (
            <Card>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                <F label="GST Percentage (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.taxPercent}
                    onChange={(e) =>
                      set({ taxPercent: Number(e.target.value) })
                    }
                  />
                </F>
                <div className="flex items-end">
                  <p className="pb-2 text-sm text-muted-foreground">
                    Applied on room tariff only (GST included in room amount).
                    Extras have no GST.
                    {form.gstNumber ? ` GSTIN: ${form.gstNumber}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {section === "users" && isAdmin && (
            <>
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    <CardTitle className="text-base">Users & Roles</CardTitle>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                    onClick={openAddUser}
                  >
                    <Plus className="h-4 w-4" /> Add User
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="w-24 text-right"> </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => {
                          const isSelf =
                            u.username === currentUser.username ||
                            u.id === currentUser.id;
                          return (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">
                                {u.name}
                              </TableCell>
                              <TableCell>{u.username}</TableCell>
                              <TableCell>{u.mobile}</TableCell>
                              <TableCell>{u.role}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => openEditUser(u)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {!isSelf && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => deleteUser(u)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Dialog
                open={userDialogOpen}
                onOpenChange={(o) => {
                  if (!o) closeUserDialog();
                  else setUserDialogOpen(true);
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingUserId ? "Edit User" : "Add User"}
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={submitUser}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <F label="Name">
                      <Input
                        value={userForm.name}
                        onChange={(e) =>
                          setUserForm({ ...userForm, name: e.target.value })
                        }
                        placeholder="Full name"
                        autoFocus
                      />
                    </F>
                    <F label="Username">
                      <Input
                        value={userForm.username}
                        onChange={(e) =>
                          setUserForm({ ...userForm, username: e.target.value })
                        }
                        placeholder="Login username"
                        autoComplete="off"
                      />
                    </F>
                    <F label="Mobile">
                      <Input
                        value={userForm.mobile}
                        onChange={(e) =>
                          setUserForm({ ...userForm, mobile: e.target.value })
                        }
                        placeholder="+91 …"
                      />
                    </F>
                    <F label="Role">
                      <Select
                        value={userForm.role}
                        onValueChange={(v) =>
                          setUserForm({ ...userForm, role: v as UserRole })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </F>
                    <F
                      label={
                        editingUserId
                          ? "Password (leave blank to keep)"
                          : "Password"
                      }
                      className="sm:col-span-2"
                    >
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) =>
                          setUserForm({ ...userForm, password: e.target.value })
                        }
                        placeholder={
                          editingUserId
                            ? "New password (optional)"
                            : "Login password"
                        }
                        autoComplete="new-password"
                      />
                    </F>
                    <DialogFooter className="sm:col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeUserDialog}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          createUser.isPending || updateUser.isPending
                        }
                      >
                        {editingUserId ? "Save Changes" : "Add User"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}

          {section === "audit" && <AuditLogSection />}
        </div>
      </div>
    </div>
  );
}

function F({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
