import nodeFetch from 'node-fetch';
import { apiUrl, graphqlUrl } from './config';
import { USER_BY_ID_STATIC_FIELDS_QUERY } from '../graphql/users';

export enum Roles {
  Moderator = 'moderator',
}

export interface AnonymousUser {
  id: string;
  firstVisit?: string;
  referrer?: string;
  isFirstVisit?: boolean;
  referralId?: string;
  referralOrigin?: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  username?: string;
  twitter?: string;
  github?: string;
  hashnode?: string;
  portfolio?: string;
  bio?: string;
  createdAt: string;
  premium: boolean;
  image: string;
  reputation: number;
  permalink: string;
}

export interface UserProfile {
  name: string;
  email?: string;
  username?: string;
  company?: string;
  title?: string;
  twitter?: string;
  github?: string;
  hashnode?: string;
  portfolio?: string;
  bio?: string;
  acceptedMarketing?: boolean;
  notificationEmail?: boolean;
  timezone?: string;
}

export interface UserShortProfile
  extends Pick<PublicProfile, 'id' | 'name' | 'image' | 'bio'> {
  username: string;
  permalink: string;
}

export interface LoggedUser extends UserProfile, AnonymousUser {
  image: string;
  infoConfirmed?: boolean;
  premium?: boolean;
  providers: string[];
  roles?: Roles[];
  createdAt: string;
  reputation?: number;
  permalink: string;
  username: string;
  timezone?: string;
  referralLink?: string;
  canSubmitArticle?: boolean;
  password?: string;
}

interface BaseError {
  error: true;
  message: string;
}

interface BadRequestError extends BaseError {
  code: 1;
  field: string;
  reason: string;
}

export type APIError = BaseError | BadRequestError;

export async function logout(): Promise<void> {
  await fetch(`${apiUrl}/v1/users/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function deleteAccount(): Promise<void> {
  await fetch(`${apiUrl}/v1/users/me`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function updateProfile(
  profile: UserProfile,
): Promise<LoggedUser | APIError> {
  const res = await fetch(`${apiUrl}/v1/users/me`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(profile),
  });
  const data = await res.json();
  if (res.status === 200) {
    return data;
  }
  if (res.status === 400) {
    return {
      error: true,
      ...data,
    };
  }
  throw new Error('Unexpected response');
}

const getProfileRequest = async (method = fetch, id: string) => {
  const userRes = await method(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: USER_BY_ID_STATIC_FIELDS_QUERY,
      variables: {
        id,
      },
    }),
  });
  if (userRes.status === 404) {
    throw new Error('not found');
  }

  const response = await userRes.json();
  return response?.data?.user;
};

export async function getProfileSSR(id: string): Promise<PublicProfile> {
  return await getProfileRequest(nodeFetch, id);
}

export async function getProfile(id: string): Promise<PublicProfile> {
  return await getProfileRequest(fetch, id);
}

export enum ReferralOriginKey {
  Squad = 'squad',
}
