import React, {
  ReactElement,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  createContext,
  useMemo,
} from 'react';
import { useMutation } from 'react-query';
import {
  Context,
  GrowthBook,
  GrowthBookContext,
  GrowthBookProvider as Provider,
  useFeatureValue,
  useFeatureIsOn as gbUseFeatureIsOn,
  GrowthBookContextValue,
} from '@growthbook/growthbook-react';
import { WidenPrimitives, JSONValue } from '@growthbook/growthbook';
import { isProduction } from '../lib/constants';
import { BootApp, BootCacheData } from '../lib/boot';
import { apiUrl } from '../lib/config';
import { useRequestProtocol } from '../hooks/useRequestProtocol';
import { Feature } from '../lib/featureManagement';

export type FeaturesReadyContextValue = {
  ready: boolean;
};

export const FeaturesReadyContext = createContext<FeaturesReadyContextValue>({
  ready: false,
});

export type GrowthBookProviderProps = {
  app: BootApp;
  user: BootCacheData['user'];
  deviceId: string;
  version?: string;
  experimentation?: BootCacheData['exp'];
  updateExperimentation?: (exp: BootCacheData['exp']) => unknown;
  children?: ReactNode;
  firstLoad?: boolean;
};

export const GrowthBookProvider = ({
  app,
  user,
  deviceId,
  version,
  experimentation,
  updateExperimentation,
  children,
}: GrowthBookProviderProps): ReactElement => {
  const { fetchMethod } = useRequestProtocol();
  const [ready, setReady] = useState(false);
  const { mutateAsync: sendAllocation } = useMutation(
    async (data: { experimentId: string; variationId: string }) => {
      const res = await fetchMethod(`${apiUrl}/e/x`, {
        method: 'POST',
        body: JSON.stringify({
          event_timestamp: new Date(),
          user_id: user.id,
          device_id: deviceId,
          experiment_id: data.experimentId,
          variation_id: data.variationId,
        }),
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
      });
      await res?.text();
    },
    {
      retry: 3,
    },
  );

  const callback = useRef<Context['trackingCallback']>();
  const [gb] = useState<GrowthBook>(
    () =>
      new GrowthBook({
        enableDevMode: !isProduction,
        trackingCallback: (...args) => callback.current?.(...args),
      }),
  );

  useEffect(() => {
    if (gb && experimentation?.features) {
      const currentFeats = gb.getFeatures();
      // Do not update when the features are already set
      if (!currentFeats || !Object.keys(currentFeats).length) {
        gb.setFeatures(experimentation.features);
        setReady(true);
      }
    }
  }, [experimentation?.features, gb]);

  useEffect(() => {
    callback.current = async (experiment, result) => {
      const variationId = result.variationId.toString();
      const key = btoa(`${experiment.key}:${variationId}`);
      if (experimentation?.e?.includes(key)) {
        return;
      }
      await sendAllocation({
        experimentId: experiment.key,
        variationId,
      });
      updateExperimentation?.({
        ...experimentation,
        e: [...(experimentation?.e ?? []), key],
      });
    };
  }, [
    user,
    deviceId,
    experimentation?.e,
    sendAllocation,
    updateExperimentation,
    experimentation,
  ]);

  useEffect(() => {
    if (!gb || !user?.id) {
      return;
    }

    let atts: Record<string, unknown> = {
      userId: user.id,
      deviceId,
      version,
      platform: app,
      ...experimentation?.a,
    };

    if (user && 'providers' in user) {
      // Logged-in user attributes
      atts = {
        ...atts,
        loggedIn: true,
        registrationDate: user.createdAt,
      };
    } else {
      // Anonymous user attributes
      atts = {
        ...atts,
        loggedIn: false,
        firstVisit: user.firstVisit,
      };
    }
    gb.setAttributes(atts);
  }, [app, user, deviceId, gb, version, experimentation?.a]);

  const featuresReadyContextValue = useMemo<FeaturesReadyContextValue>(() => {
    return {
      ready,
    };
  }, [ready]);

  return (
    <FeaturesReadyContext.Provider value={featuresReadyContextValue}>
      <Provider growthbook={gb}>{children}</Provider>
    </FeaturesReadyContext.Provider>
  );
};

export const useFeatureIsOn = (feature: Feature<JSONValue>): boolean =>
  gbUseFeatureIsOn(feature.id);

export const useFeature = <T extends JSONValue>(
  feature: Feature<T>,
): WidenPrimitives<T> => useFeatureValue(feature.id, feature.defaultValue);

export const useGrowthBookContext = (): GrowthBookContextValue =>
  useContext(GrowthBookContext);
