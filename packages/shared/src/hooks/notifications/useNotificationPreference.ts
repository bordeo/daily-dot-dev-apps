import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useCallback } from 'react';
import {
  clearNotificationPreference,
  getNotificationPreferences,
  hideSourceFeedPosts,
  muteNotification,
  NotificationPreference,
  notificationPreferenceMap,
  NotificationPreferenceStatus,
  showSourceFeedPosts,
} from '../../graphql/notifications';
import { generateQueryKey, RequestKey } from '../../lib/query';
import { useAuthContext } from '../../contexts/AuthContext';
import { NotificationType } from '../../components/notifications/utils';
import { Squad } from '../../graphql/sources';
import { updateFlagsCache } from '../../graphql/source/common';

interface UseNotificationPreference {
  isFetching: boolean;
  isPreferencesReady: boolean;
  preferences: NotificationPreference[];
  hideSourceFeedPosts(): Promise<unknown>;
  showSourceFeedPosts(): Promise<unknown>;
  muteNotification: typeof muteNotification;
  clearNotificationPreference: typeof clearNotificationPreference;
}

interface UseNotificationPreferenceProps {
  params: Parameters<typeof getNotificationPreferences>[0];
  squad?: Squad;
}

export const checkHasMutedPreference = (
  { notificationType, referenceId, status }: NotificationPreference,
  type: NotificationType,
  id: string,
): boolean =>
  status === NotificationPreferenceStatus.Muted &&
  notificationType === type &&
  referenceId === id;

export const useNotificationPreference = ({
  params,
  squad,
}: UseNotificationPreferenceProps): UseNotificationPreference => {
  const { user } = useAuthContext();
  const client = useQueryClient();
  const key = generateQueryKey(RequestKey.NotificationPreference, user, params);
  const { data, isFetched, isLoading } = useQuery(
    key,
    () => getNotificationPreferences(params),
    { enabled: params?.length > 0, initialData: () => [] },
  );
  const { mutateAsync: muteNotificationAsync } = useMutation(muteNotification, {
    onSuccess: (_, { referenceId, type }) => {
      client.setQueryData<NotificationPreference[]>(key, (oldData = []) => {
        const preference: NotificationPreference = {
          referenceId,
          notificationType: type,
          type: notificationPreferenceMap[type],
          userId: user.id,
          status: NotificationPreferenceStatus.Muted,
        };

        return [...oldData, preference];
      });
    },
  });

  const { mutateAsync: clearNotificationPreferenceAsync } = useMutation(
    clearNotificationPreference,
    {
      onSuccess: (_, { referenceId, type }) => {
        client.setQueryData<NotificationPreference[]>(key, (oldData) => {
          if (!oldData) {
            return [];
          }

          return oldData.filter(
            (preference) =>
              !checkHasMutedPreference(preference, type, referenceId),
          );
        });
      },
    },
  );

  const { mutateAsync: hideSourceFeedPostsAsync } = useMutation(
    hideSourceFeedPosts,
    {
      onSuccess: () => {
        updateFlagsCache(client, squad, user, { hideFeedPosts: true });
      },
    },
  );

  const { mutateAsync: showSourceFeedPostsAsync } = useMutation(
    showSourceFeedPosts,
    {
      onSuccess: () => {
        updateFlagsCache(client, squad, user, { hideFeedPosts: false });
      },
    },
  );

  return {
    hideSourceFeedPosts: useCallback(
      () => hideSourceFeedPostsAsync(squad?.id),
      [hideSourceFeedPostsAsync, squad?.id],
    ),
    showSourceFeedPosts: useCallback(
      () => showSourceFeedPostsAsync(squad?.id),
      [showSourceFeedPostsAsync, squad?.id],
    ),
    isFetching: isLoading,
    preferences: data,
    muteNotification: muteNotificationAsync,
    clearNotificationPreference: clearNotificationPreferenceAsync,
    isPreferencesReady: isFetched,
  };
};
