import { React, useEffect, useState } from 'react';
import { Combobox } from 'react-widgets';
import { FaCog } from 'react-icons/fa';
import { SpinnerCircular } from 'spinners-react';
import { Tree } from 'react-arborist';
import Settings from './Settings';
import Node from './Node';
import Panel from './Panel';
import Row from './Row';

import rpc from '../rpc';

export default function Browser() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [repoOptions, setRepoOptions] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [repo, setRepo] = useState('');

  useEffect(() => {
    rpc.request('get_state', {}).then((state) => {
      setApiKey(state.token);
      setRepo(state.repo);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('repo', JSON.stringify(repo));
  }, [repo]);

  const loadRepo = () => {
    setLoading(true); // this doesn't work
    setTimeout(() => {
      rpc.request('set_source', { repo, token: apiKey }).then((results) => {
        setContents(results);
        setLoading(false);
      }).catch((err) => {
        alert(err.message);
        setLoading(false);
      });
    }, 100);
  };

  const searchFilter = (node, search) => {
    const tokens = search.toLowerCase().split(/\s+/);
    return tokens.every((t) => node.data.path.toLowerCase().indexOf(t) !== -1);
  };

  return (
    <div id="appwrap">
      <Panel style={{ flex: 0 }}>
        <Row>
          <label htmlFor="repo-input">Repository </label>
          <Combobox
            data={repoOptions}
            inputProps={{ className: 'input', id: 'repo-input' }}
            value={repo}
            onToggle={(isOpening) => {
              if (!isOpening) return;
              rpc.request('get_repo_options').then((results) => {
                setRepoOptions(() => results);
              });
            }}
            onChange={(value) => {
              setRepo(value);
            }}
          />
          <button type="button" style={{ marginLeft: '4px' }} className="btn" onClick={loadRepo}>Load</button>
          <button aria-label="Settings" type="button" style={{ marginLeft: '4px' }} className="btn" onClick={() => setShowSettings(true)}><FaCog /></button>
        </Row>
        <Row>
          <label htmlFor="search-input">Search </label>
          <input
            id="search-input"
            type="text"
            className="input"
            value={searchString}
            onChange={(event) => {
              setSearchString(event.target.value);
            }}
          />
        </Row>
      </Panel>
      <Panel style={{ padding: '4px' }}>
        {loading
          ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <SpinnerCircular />
            </div>
          )

          : (
            <div className="treeWrap">
              <Tree height={300} width="100%" searchTerm={searchString} searchMatch={searchFilter} data={contents} idAccessor="path" openByDefault={false} indent={16}>{Node}</Tree>
            </div>
          )}
      </Panel>
      {showSettings && <Settings
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        repoOptions={repoOptions}
        setRepoOptions={setRepoOptions}
      />}

    </div>
  );
}
