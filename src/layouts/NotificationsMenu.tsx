import { useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useEntities';
import { getSessionUserId } from '@/services/auth';
import { notificationService } from '@/services/api';
import type { AppNotification } from '@/types';
import { relativeTime } from '@/utils/format';
import { cn } from '@/lib/utils';

export function NotificationsMenu() {
  const queryClient = useQueryClient();
  const userId = getSessionUserId();
  const queryKey = ['notifications', userId] as const;
  const { data: notifications = [] } = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  const handleOpenChange = (open: boolean) => {
    if (!open || !userId) return;

    const current = queryClient.getQueryData<AppNotification[]>(queryKey) ?? notifications;
    const mine = current.filter((n) => n.userId === userId);
    const alreadyRead = mine.filter((n) => n.read);
    const unreadOnes = mine.filter((n) => !n.read);

    if (alreadyRead.length === 0 && unreadOnes.length === 0) return;

    queryClient.setQueryData<AppNotification[]>(
      queryKey,
      unreadOnes.map((n) => ({ ...n, read: true })),
    );

    void (async () => {
      await Promise.all(alreadyRead.map((n) => notificationService.remove(n.id)));
      await Promise.all(unreadOnes.map((n) => notificationService.update(n.id, { read: true })));
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    })();
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 border-b px-3 py-2.5 text-left',
                  !n.read && 'bg-primary/5',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                <span className="text-xs text-muted-foreground">{n.message}</span>
                <span className="text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
