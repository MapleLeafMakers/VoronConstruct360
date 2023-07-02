import PropTypes from 'prop-types';
import { FaCog } from 'react-icons/fa';
import { React, useState } from 'react';
import Row from './Row';
import Panel from './Panel';
import rpc from '../Helpers/rpc';
import axios from 'axios';
export default function Settings({ onClose, apiKey, setApiKey }) {
  const [token, setToken] = useState(apiKey);
  const [interfaceUrl, setInterfaceUrl] = useState(window.location);

  const cacheBust = async () => {
    const headers = {
      "Pragma": "no-cache",
      "Expires": -1,
      "Cache-Control": "no-cache"
    };

    await axios.get("/main.js", { headers });
    await axios.get("/base.css", { headers });
    window.location.reload();
  };


  return (
    <div style={{ zIndex: 99999, background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="panel" style={{ zIndex: 99999, minWidth: 200, maxWidth: 400, margin: 'auto' }}>
        <Panel><Row><h3 className="dialog-header"><FaCog />Settings</h3></Row></Panel>
        <Panel style={{ padding: '8px' }}>
          <Row>
            <label htmlFor="api-key-input">Github API Key </label>
            <input
              id="api-key-input"
              value={token}
              className="input"
              onChange={(e) => {
                setToken(e.target.value);
              }}
            />
          </Row>
          <Row>
            <button type="button" class="btn btn-sm" onClick={cacheBust}>Force Reload</button>
          </Row>
        </Panel>
        <Panel style={{ flex: 1 }} />
        <Panel>
          <Row style={{ padding: '8px 12px' }}>
            <div style={{ flex: 1 }}></div>
            <button type="button" className="btn btn-sm" style={{ marginRight: '8px' }} onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-sm" onClick={() => {
              setApiKey(token);
              rpc.request('kv_set', { key: 'token', value: token });
              onClose();
              setTimeout(() => {
                window.location = interfaceUrl;
              }, 100);
            }}>OK</button>
          </Row>
        </Panel>
      </div>

    </div >
  );
}

Settings.propTypes = {
  onClose: PropTypes.func.isRequired,
};
