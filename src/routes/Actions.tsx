import { h } from 'preact';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'preact/hooks';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

import {
  calculateRewardForStaker,
  getBondAccounts,
  getStakeAccounts,
  getUserACSBalance,
} from '../libs/program';
import { ConfigContext } from '../AppContext';
import { BondAccount, StakeAccount, StakePool } from '../libs/ap/state';
import { clsxp, formatPenyACSCurrency } from '../libs/utils';
import { RouteLink } from '../layout/Router';
import { Header } from '../components/Header';
import { useWallet } from '../components/wallet-adapter/useWallet';
import { useConnection } from '../components/wallet-adapter/useConnection';
import env from '../libs/env';

export const Actions = () => {
  const { poolId, classPrefix } = useContext(ConfigContext);
  const { connection } = useConnection();
  const { publicKey, disconnect, disconnecting, connected } = useWallet();
  const [balance, setBalance] = useState<BN | null>(null);
  const [stakedAccount, setStakedAccount] = useState<
    StakeAccount | null | undefined
  >(undefined);
  const [bondAccount, setBondAccount] = useState<
    BondAccount | null | undefined
  >(undefined);
  const [stakePool, setStakePool] = useState<StakePool | undefined>(undefined);

  useEffect(() => {
    if (!(publicKey && connection)) {
      return;
    }
    (async () => {
      setBalance(
        await getUserACSBalance(connection, publicKey, env.PROGRAM_ID)
      );
    })();
  }, [publicKey, connection]);

  useEffect(() => {
    if (!(poolId && connection)) {
      return;
    }
    (async () => {
      setStakePool(await StakePool.retrieve(connection, new PublicKey(poolId)));
    })();
  }, [poolId, connection]);

  useEffect(() => {
    if (!(publicKey && poolId && connection)) {
      return;
    }
    (async () => {
      const stakedAccounts = await getStakeAccounts(
        connection,
        publicKey,
        env.PROGRAM_ID
      );
      if (stakedAccounts != null && stakedAccounts.length > 0) {
        const sAccount = stakedAccounts.find((st) => {
          const sa = StakeAccount.deserialize(st.account.data);
          return sa.stakePool.toBase58() === poolId;
        });
        if (sAccount) {
          const sa = StakeAccount.deserialize(sAccount.account.data);
          setStakedAccount(sa);
        } else {
          setStakedAccount(null);
        }
      } else {
        setStakedAccount(null);
      }
    })();
  }, [publicKey, connection, poolId]);

  useEffect(() => {
    if (!(publicKey && poolId && connection)) {
      return;
    }
    (async () => {
      const bondAccounts = await getBondAccounts(
        connection,
        publicKey,
        env.PROGRAM_ID
      );
      if (bondAccounts != null && bondAccounts.length > 0) {
        const bAccount = bondAccounts.find((st) => {
          const sa = BondAccount.deserialize(st.account.data);
          return sa.stakePool.toBase58() === poolId;
        });
        if (bAccount) {
          const ba = BondAccount.deserialize(bAccount.account.data);
          setBondAccount(ba);
        } else {
          setBondAccount(null);
        }
      } else {
        setBondAccount(null);
      }
    })();
  }, [publicKey, connection, poolId]);

  const claimableStakeAmount = useMemo(() => {
    if (!(stakedAccount && stakePool)) {
      return null;
    }
    const reward = calculateRewardForStaker(
      stakePool.currentDayIdx - stakedAccount.lastClaimedOffset.toNumber(),
      stakePool,
      stakedAccount.stakeAmount as BN
    );
    return reward;
  }, [stakedAccount, stakePool]);

  const claimableBondAmount = useMemo(() => {
    if (!(bondAccount && stakePool)) {
      return null;
    }
    const reward = calculateRewardForStaker(
      stakePool.currentDayIdx - bondAccount.lastClaimedOffset.toNumber(),
      stakePool,
      bondAccount.totalStaked as BN
    );
    return reward;
  }, [bondAccount, stakePool]);

  const claimableAmount = useMemo(() => {
    return (claimableBondAmount ?? 0) + (claimableStakeAmount ?? 0);
  }, [claimableBondAmount, claimableStakeAmount]);

  const disconnectHandler = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [disconnect]);

  return (
    <div className={clsxp(classPrefix, 'actions_root')}>
      {connected && disconnecting && (
        <Header>
          <div className={clsxp(classPrefix, 'actions_actions_disconnect')}>
            Disconnecting...
          </div>
        </Header>
      )}
      {connected && !disconnecting && (
        <Header>
          <div
            className={clsxp(classPrefix, 'actions_actions_disconnect')}
            onClick={disconnectHandler}
          >
            Disconnect
          </div>
        </Header>
      )}

      <div className={clsxp(classPrefix, 'actions_logo')}>
        <svg
          width='48'
          height='48'
          viewBox='0 0 48 48'
          fill='white'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M22.8221 47.17C30.5621 47.17 37.1321 43.48 40.1021 36.28V46H47.9321V24.13C47.9321 9.91 38.2121 0.369997 24.2621 0.369997C10.1321 0.369997 0.23207 10.18 0.23207 24.13C0.23207 38.8 11.2121 47.17 22.8221 47.17ZM24.1721 39.25C14.9921 39.25 8.87207 32.77 8.87207 23.77C8.87207 14.77 14.9921 8.29 24.1721 8.29C33.3521 8.29 39.4721 14.77 39.4721 23.77C39.4721 32.77 33.3521 39.25 24.1721 39.25Z'
            fill='#E7E5E4'
          />
        </svg>
      </div>

      <div>
        <div
          className={clsxp(
            classPrefix,
            'actions_staked_amount',
            (stakedAccount === undefined || bondAccount === undefined) &&
              'actions_blink'
          )}
        >
          {formatPenyACSCurrency(
            (stakedAccount?.stakeAmount.toNumber() ?? 0) +
              (bondAccount?.totalStaked.toNumber() ?? 0)
          )}{' '}
          ACS locked
        </div>
        <div
          className={clsxp(
            classPrefix,
            'actions_balance',
            balance === undefined && 'actions_blink'
          )}
        >
          {formatPenyACSCurrency(balance?.toNumber() ?? 0)} ACS available
        </div>
        <div
          className={clsxp(
            classPrefix,
            'actions_balance',
            (stakedAccount === undefined || bondAccount === undefined) &&
              'actions_blink'
          )}
        >
          {formatPenyACSCurrency(claimableAmount ?? 0)} ACS claimable
        </div>
      </div>

      <div className={clsxp(classPrefix, 'actions_links_wrapper')}>
        <RouteLink
          className={clsxp(classPrefix, 'actions_button')}
          href='/stake'
        >
          Lock
        </RouteLink>
        {stakedAccount && stakedAccount.stakeAmount.toNumber() > 0 ? (
          <RouteLink
            className={clsxp(classPrefix, 'actions_button')}
            href='/unstake'
          >
            Unlock ACS
          </RouteLink>
        ) : (
          <span
            className={clsxp(
              classPrefix,
              'actions_button',
              'actions_button_disabled'
            )}
          >
            Unlock ACS
          </span>
        )}
        {claimableAmount && claimableAmount > 0 ? (
          <RouteLink
            className={clsxp(classPrefix, 'actions_button')}
            href='/claim'
          >
            Claim
          </RouteLink>
        ) : (
          <span
            className={clsxp(
              classPrefix,
              'actions_button',
              'actions_button_disabled'
            )}
          >
            Claim
          </span>
        )}
      </div>
    </div>
  );
};
