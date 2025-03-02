import { GET_REFERRING_USER_QUERY } from '@dailydotdev/shared/src/graphql/users';
import { ReferralCampaignKey } from '@dailydotdev/shared/src/hooks';
import { graphqlUrl } from '@dailydotdev/shared/src/lib/config';
import { isDevelopment } from '@dailydotdev/shared/src/lib/constants';
import request from 'graphql-request';
import React, { FunctionComponent, ReactElement, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { NextSeo, NextSeoProps } from 'next-seo';
import { setCookie } from '@dailydotdev/shared/src/lib/cookie';
import { oneYear } from '@dailydotdev/shared/src/lib/dateFormat';
import { useReferralConfig } from '@dailydotdev/shared/src/hooks/referral/useReferralConfig';
import { defaultOpenGraph } from '../next-seo';
import { JoinPageProps } from '../components/invite/common';
import { AISearchInvite } from '../components/invite/AISearchInvite';
import Custom404Seo from './404';

type ReferralRecord<T> = Record<ReferralCampaignKey, T>;

const componentsMap: ReferralRecord<FunctionComponent<JoinPageProps>> = {
  search: AISearchInvite,
};

const Page = ({
  referringUser,
  campaign,
  token,
}: JoinPageProps): ReactElement => {
  const Component = componentsMap[campaign];
  const { title, description, images, redirectTo } = useReferralConfig({
    campaign,
    referringUser,
  });

  useEffect(() => {
    if (!componentsMap[campaign]) {
      return;
    }

    setCookie('join_referral', `${referringUser.id}:${campaign}`, {
      path: '/',
      maxAge: oneYear,
      secure: !isDevelopment,
      domain: process.env.NEXT_PUBLIC_DOMAIN,
      sameSite: 'lax',
    });
  }, [campaign, referringUser.id]);

  const seoProps: NextSeoProps = {
    title,
    description,
    openGraph: { ...defaultOpenGraph, images },
  };
  const seoComponent = <NextSeo {...seoProps} />;

  if (!Component) {
    return (
      <>
        {seoComponent}
        <Custom404Seo />
      </>
    );
  }

  return (
    <>
      {seoComponent}
      <Component
        token={token}
        campaign={campaign}
        redirectTo={redirectTo}
        referringUser={referringUser}
      />
    </>
  );
};

interface QueryParams {
  ctoken?: string;
  userid: string;
  cid: ReferralCampaignKey;
}

export const getServerSideProps: GetServerSideProps<JoinPageProps> = async ({
  query,
  res,
}) => {
  const validateUserId = (value: string) => !!value && value !== '404';
  const params = query as unknown as QueryParams;
  const { userid: userId, cid: campaign, ctoken: token = null } = params;

  if (!validateUserId(userId as string) || !campaign) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const result = await request<{ user: JoinPageProps['referringUser'] }>(
    graphqlUrl,
    GET_REFERRING_USER_QUERY,
    {
      id: userId,
    },
  );

  res.setHeader(
    'Cache-Control',
    `public, max-age=0, must-revalidate, s-maxage=${24 * 60 * 60}`,
  );

  return {
    props: {
      token,
      campaign,
      referringUser: result?.user,
    },
  };
};

export default Page;
