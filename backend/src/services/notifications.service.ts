import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http.js';
import type { AuthedUser } from '../middleware/auth.js';

export interface ListNotificationsInput {
  unreadOnly: boolean;
  limit: number;
  offset: number;
}

export async function list(viewer: AuthedUser, query: ListNotificationsInput) {
  const where = {
    recipientId: viewer.id,
    ...(query.unreadOnly ? { isRead: false } : {})
  };

  const [total, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset
    })
  ]);

  return { notifications: rows, meta: { total, limit: query.limit, offset: query.offset } };
}

export async function markRead(viewer: AuthedUser, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.recipientId !== viewer.id) {
    throw new HttpError(404, 'Notification not found');
  }
  if (notification.isRead) {
    return notification;
  }
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllRead(viewer: AuthedUser) {
  const result = await prisma.notification.updateMany({
    where: { recipientId: viewer.id, isRead: false },
    data: { isRead: true }
  });
  return { updated: result.count };
}
