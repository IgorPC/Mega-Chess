import { NotificationEventsService } from './notification-events.service';
import { Notification, NotificationType } from '../entities/notification.entity';

describe('NotificationEventsService', () => {
  let service: NotificationEventsService;

  beforeEach(() => {
    service = new NotificationEventsService();
  });

  it('invokes the listener registered via onCreated when emitCreated fires', () => {
    const listener = jest.fn();
    service.onCreated(listener);

    const notification = { id: 'n-1', type: NotificationType.FRIEND_REQUEST } as Notification;
    service.emitCreated('user-1', notification);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('user-1', notification);
  });

  it('invokes multiple listeners registered for the same event', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    service.onCreated(listenerA);
    service.onCreated(listenerB);

    const notification = { id: 'n-2' } as Notification;
    service.emitCreated('user-2', notification);

    expect(listenerA).toHaveBeenCalledWith('user-2', notification);
    expect(listenerB).toHaveBeenCalledWith('user-2', notification);
  });

  it('does not throw when emitCreated is called with no listeners registered', () => {
    expect(() => service.emitCreated('user-3', { id: 'n-3' } as Notification)).not.toThrow();
  });
});
