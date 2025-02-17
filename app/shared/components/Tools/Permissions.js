// @flow
import React, { Component } from 'react';
import { translate } from 'react-i18next';
import { find } from 'lodash';
import eos from '../../actions/helpers/eos';

import { Button, Container, Icon, Header, Message, Popup, Segment, Table } from 'semantic-ui-react';

import ToolsModalPermissionAuth from './Modal/Permissions/Auth';
import WalletPanelLocked from '../Wallet/Panel/Locked';
import EOSAccount from '../../utils/EOS/Account';
import EOSContract from '../../utils/EOS/Contract';

class ToolsPermissions extends Component<Props> { 
  constructor(props) {
    super(props);
    
    this.state = Object.assign({}, {
      linkAuthHistory: []
    });
  } 
  componentDidMount() {
    const {
      actions,
      connection,
      settings
    } = this.props;
    actions.getAbi('eosio');

    eos(connection).getActions(settings.account, -1, -100000).then((results) => {
      if (results && results.actions) {
        const linkAuthHistory = [...this.state.linkAuthHistory];
        results.actions.map(action => {
          if (action && action.action_trace && action.action_trace.act) {
            const trace = action.action_trace.act;
            if (trace.name == "linkauth") {
              linkAuthHistory.push(trace.data);
            }
          }
        });
        this.setState({ linkAuthHistory });
      }
    })
  }
  unlinkAuth = (type, requirement) => {
    const {
      actions
    } = this.props;
    actions.unlinkauth(type);
  }
  isValidContract = (name) => {
    const { contracts } = this.props;
    return (
      contracts[name]
      && contracts[name] instanceof EOSContract
    );
  }
  render() {
    const {
      accounts,
      actions,
      blockExplorers,
      contracts,
      keys,
      settings,
      system,
      t,
      validate,
      wallet,
      wallets,
      connection
    } = this.props;

    const {
      linkAuthHistory
    } = this.state;

    if (!wallets || !wallets.length) {
      return false;
    }

    // Ensure the contract is loaded and valid
    let contract = null;
    if (contracts && contracts.eosio && contracts.eosio.abi)
      contract = new EOSContract(contracts.eosio.abi, 'eosio');

    const contractActions = contract && 
    contract.getActions().filter( (action) => {
      return ['updateauth','deleteauth','linkauth',
        'unlinkauth','canceldelay','init',
        'onblock','onerror','setabi','setalimits',
        'setpriv','setcode','setparams', 'setram',
        'setramrate','updtrevision'].indexOf(action.name) === -1
    }).map((action) => { 
      return {
        text: action.name,
        value: action.type
      }
    });

    if (settings.walletMode !== 'watch' && !(keys && keys.key)) {
      return (
        <WalletPanelLocked
          actions={actions}
          settings={settings}
          validate={validate}
          wallet={wallet}
          connection={connection}
        />
      );
    }

    const account = accounts[settings.account];
    if (!account) return false;

    let { pubkey } = wallet;
    if (!pubkey) {
      if (keys && keys.pubkey) {
        ({ pubkey } = keys);
      }
    }
    let authorization = new EOSAccount(account).getAuthorization(pubkey, true);
    if (settings.walletMode === 'watch') {
      authorization = {
        perm_name: settings.authorization
      };
    }

    return (
      <Segment basic>
        <Container>
          {(settings.advancedPermissions)
            ? (
              <ToolsModalPermissionAuth
                actions={actions}
                auth={false}
                blockExplorers={blockExplorers}
                button={{
                  color: 'blue',
                  content: t('tools_modal_permissions_auth_create_button'),
                  fluid: false,
                  icon: 'circle plus',
                  size: 'small'
                }}
                contractActions={contractActions}
                linkAuthHistory={linkAuthHistory}
                onClose={this.onClose}
                settings={settings}
                system={system}
                connection={connection}
              />
            )
            : false
          }
          <Header
            content={t('tools_permissions_header')}
            subheader={t('tools_permissions_subheader')}
            textAlign="left"
          />
        </Container>
        <Message
          content={t('tools_permissions_info_content')}
          header={t('tools_permissions_info_header')}
          icon="info circle"
          info
        />
        <Segment
          color="blue"
        >
          {(settings.walletMode === 'watch')
            ? (
              <Header
                color="orange"
                content={t('tools_permissions_current_wallet_watch_header')}
                icon="eye"
                size="small"
                subheader={t('tools_permissions_current_wallet_watch_subheader')}
              />
            )
            : (
              <Header
                content={t('tools_permissions_current_wallet_header', { pubkey })}
                icon="key"
                size="small"
                subheader={t('tools_permissions_current_wallet_subheader')}
              />
            )
          }
        </Segment>

        {(account.permissions.map((data) => (
          <Segment
            color="purple"
            key={`${account}-${data.perm_name}`}
          >
            {(
              !authorization
              || (data.perm_name === 'owner' && authorization.perm_name !== 'owner')
              || (data.perm_name === 'active' && !(['active', 'owner'].includes(authorization.perm_name)))
            )
              ? (
                <Popup
                  content={t('tools_modal_permissions_auth_edit_button_disabled')}
                  inverted
                  position="top center"
                  trigger={(
                    <Button
                      content={t('tools_modal_permissions_auth_edit_button')}
                      floated="right"
                      icon="pencil"
                      size="small"
                    />
                  )}
                />
              )
              : (
                <ToolsModalPermissionAuth
                  actions={actions}
                  auth={data}
                  blockExplorers={blockExplorers}
                  button={{
                    color: 'purple',
                    content: t('tools_modal_permissions_auth_edit_button'),
                    fluid: false,
                    floated: 'right',
                    icon: 'pencil',
                    size: 'small'
                  }}
                  contractActions={contractActions}
                  linkAuthHistory={linkAuthHistory}
                  onClose={this.onClose}
                  pubkey={pubkey}
                  settings={settings}
                  system={system}
                  connection={connection}
                />
              )
            }
            <Header floated="left" size="medium">
              <Icon name="lock" />
              <Header.Content>
                {t('tools_modal_permissions_auth_permission_name', { permissionName: data.perm_name })}
                <Header.Subheader>
                  {t('tools_modal_permissions_auth_permission_structure', {
                    threshold: data.required_auth.threshold,
                    total: data.required_auth.keys.length + data.required_auth.accounts.length
                  })}
                  {(data.parent)
                    ? t('tools_modal_permissions_auth_permission_child_of', { parent: data.parent })
                    : false
                  }
                </Header.Subheader>
              </Header.Content>
            </Header>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell textAlign="right">Weight</Table.HeaderCell>
                  <Table.HeaderCell>Permission</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.required_auth.accounts.map((permission) => (
                  <Table.Row key={`${data.perm_name}-${permission.permission.actor}-${permission.permission.permission}`}>
                    <Table.Cell collapsing textAlign="right">{permission.weight}</Table.Cell>
                    <Table.Cell>
                      {permission.permission.actor}@{permission.permission.permission}
                    </Table.Cell>
                  </Table.Row>
                ))}
                {data.required_auth.keys.map((permission) => (
                  <Table.Row key={`${data.perm_name}-${permission.key}`}>
                    <Table.Cell collapsing textAlign="right">{permission.weight}</Table.Cell>
                    <Table.Cell>{permission.key}</Table.Cell>
                  </Table.Row>
                ))}
                {linkAuthHistory.filter((perm) => {return perm.requirement == data.perm_name})
                  .map((linkauth) => (
                  <Table.Row key={`${linkauth.type}-${linkauth.requirement}`}>
                    <Table.Cell collapsing textAlign="right">
                      {/*
                      <Button 
                        floated="right"
                        icon="delete"
                        size="small"
                        onClick={() => this.unlinkAuth(linkauth.type, linkauth.requirement)}
                      />*/}
                    </Table.Cell>
                    <Table.Cell>{linkauth.type}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Segment>
        )))}
      </Segment>
    );
  }
}

export default translate('tools')(ToolsPermissions);
