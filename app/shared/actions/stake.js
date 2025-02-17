import { Decimal } from 'decimal.js';
import { findIndex } from 'lodash';

import * as types from './types';

import { delegatebwParams } from './system/delegatebw';
import { undelegatebwParams } from './system/undelegatebw';

import * as AccountActions from './accounts';
import * as TableActions from './table';
import eos from './helpers/eos';

export function setStake(accountName, netAmount, cpuAmount) {
  return (dispatch: () => void, getState) => {
    const {
      accounts,
      connection,
      tables,
      settings
    } = getState();

    const currentAccount = accounts[settings.account];
    let delegations = tables &&
                        tables.eosio &&
                        tables.eosio[settings.account] &&
                        tables.eosio[settings.account].delband.rows;
    if (!delegations && settings.account.indexOf('.') > 0) {
      const prefix = settings.account.split('.')[0];
      const suffix = settings.account.split('.')[1];
      delegations = 
        tables &&
        tables.eosio &&
        tables.eosio[prefix] &&
        tables.eosio[prefix][suffix] &&
        tables.eosio[prefix][suffix].delband &&
        tables.eosio[prefix][suffix].delband.rows;
    }
    const {
      increaseInStake,
      decreaseInStake
    } = getStakeChanges(currentAccount, accountName, delegations, netAmount, cpuAmount, settings);

    dispatch({ type: types.SYSTEM_STAKE_PENDING });
    return eos(connection, true).transaction(tr => {
      if (increaseInStake.netAmount > 0 || increaseInStake.cpuAmount > 0) {
        tr.delegatebw(delegatebwParams(
          currentAccount.account_name,
          accountName,
          increaseInStake.netAmount,
          increaseInStake.cpuAmount,
          0,
          settings
        ));
      }
      if (decreaseInStake.netAmount > 0 || decreaseInStake.cpuAmount > 0) {
        tr.undelegatebw(undelegatebwParams(
          currentAccount.account_name,
          accountName,
          decreaseInStake.netAmount,
          decreaseInStake.cpuAmount,
          settings
        ));
      }
    }, {
      broadcast: connection.broadcast,
      expireInSeconds: connection.expireInSeconds,
      sign: connection.sign
    }).then((tx) => {
      setTimeout(() => {
        if (accountName === settings.account) {
          dispatch(AccountActions.getAccount(accountName));
        }
        dispatch(TableActions.getTable('eosio', settings.account, 'delband'));
      }, 500);
      return dispatch({
        payload: { tx },
        type: types.SYSTEM_STAKE_SUCCESS
      });
    }).catch((err) => {
      dispatch({
        payload: { err },
        type: types.SYSTEM_STAKE_FAILURE
      });
    });
  };
}

export function resetStakeForm() {
  return (dispatch: () => void) => {
    dispatch({
      type: types.RESET_SYSTEM_STATES
    });
  };
}

function getStakeChanges(currentAccount, accountName, delegations, nextNetAmount, nextCpuAmount, settings) {
  let accountResources;
   if (accountName !== currentAccount.account_name) {
    const index = findIndex(delegations, { to: accountName });
     if (index === -1) {
      accountResources = { 
        cpu_weight: '0 ' + settings.blockchain.tokenSymbol, 
        net_weight: '0 ' + settings.blockchain.tokenSymbol 
      };
    } else {
      accountResources = delegations[index];
    }
  }

  const {
    cpu_weight,
    net_weight
  } = accountResources || currentAccount.self_delegated_bandwidth;

  const currentCpuAmount = new Decimal(cpu_weight.split(' ')[0]);
  const currentNetAmount = new Decimal(net_weight.split(' ')[0]);

  const increaseInStake = {
    netAmount: Math.max(0, (nextNetAmount - currentNetAmount)),
    cpuAmount: Math.max(0, (nextCpuAmount - currentCpuAmount))
  };

  const decreaseInStake = {
    netAmount: Math.max(0, (currentNetAmount - nextNetAmount)),
    cpuAmount: Math.max(0, (currentCpuAmount - nextCpuAmount))
  };

  return {
    increaseInStake,
    decreaseInStake
  };
}

export default {
  resetStakeForm,
  setStake
};
