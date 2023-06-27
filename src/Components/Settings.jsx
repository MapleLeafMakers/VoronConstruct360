import PropTypes from 'prop-types';
import { React, useEffect, useState } from 'react';
import Row from './Row';
import Panel from './Panel';
import rpc from '../rpc';

export default function Settings({ onClose, apiKey, setApiKey }) {
  const [repos, setRepos] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);

  useEffect(() => {
    rpc.request("get_repo_options").then(setRepos);
  }, []);
  return (
    <div style={{ zIndex: 99999, background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="panel" style={{ zIndex: 99999, minWidth: 200, maxWidth: 400, margin: 'auto' }}>
        <Panel>
          <Row>
            <label htmlFor="repo-input">Github API Key </label>
            <input
              value={apiKey}
              className='input'
              onChange={(e) => {
                setApiKey(e.target.value);
              }}
            />
          </Row>
          <Row>
            <label htmlFor="repo-input">Repositories </label>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <select onChange={(e) => setSelectedRepos(Array.from(e.target.selectedOptions).map(e => e.textContent))} className='input' multiple={true}>
                {repos.map((r) =>
                  <option selected={selectedRepos.indexOf(r) !== -1}>{r}</option>
                )}
              </select>
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                <div style={{ flex: 1 }} />
                <button disabled={selectedRepos.length == 0} onClick={() => {
                  const toKeep = repos.filter((r) => selectedRepos.indexOf(r) === -1);
                  rpc.request('set_repo_options', { repos: toKeep }).then(() => {
                    setRepos(toKeep);
                    setSelectedRepos([]);
                  });
                }} className="btn btn-sm" type="button">Delete Selected</button>
              </div>
            </div>
          </Row>
        </Panel>
        <Panel style={{ flex: 1 }} />
        <Panel>
          <Row>
            <button type="button" className="btn btn-sm" onClick={onClose}>Back</button>
          </Row>
        </Panel>
      </div>

    </div >
  );
}

Settings.propTypes = {
  onClose: PropTypes.func.isRequired,
};
