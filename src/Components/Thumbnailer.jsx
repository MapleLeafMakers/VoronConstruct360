import PropTypes from 'prop-types';
import { React, useEffect, useState } from 'react';
import { FaCube, FaCamera } from 'react-icons/fa';
import Row from './Row';
import Panel from './Panel';
import rpc from '../rpc';

export default function Thumbnailer({ file, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const allRepos = [...new Set(Object.values(file.content_types).map(ct => ct.url.replace(/^https?:\/\/api.github.com\/repos\//, '').split('/').slice(0, 2).join('/')))];
  const [selectedRepo, setSelectedRepo] = useState(allRepos[0]);

  useEffect(() => {
    if (file?.content_types?.thumb) {
      rpc.request("get_thumb", { url: file.content_types.thumb.url }).then(setDataUrl);
    }
  }, [file])

  return (
    <div style={{ zIndex: 99999, background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="panel" style={{ zIndex: 99999, minWidth: 200, maxWidth: 400, margin: 'auto' }}>
        <Panel>
          {dataUrl ? <img src={dataUrl} style={{ maxWidth: 256, maxHeight: 256, margin: 'auto', objectFit: 'cover' }} />
            : <FaCube size={256} style={{ margin: 'auto' }} />}
          <Row style={{ justifyContent: 'center' }}>
            <button onClick={() => {
              rpc.request("get_screenshot").then(setDataUrl).then(() => setHasScreenshot(true));
            }} type="button" className="btn"><FaCamera style={{ verticalAlign: 'text-top' }} /> Screenshot</button>
          </Row>
        </Panel>
        {hasScreenshot && <Row>
          <label>Upload to </label>
          <select className='input' onChange={(e) => {
            setSelectedRepo(e.target.value);
          }}>
            {allRepos.map((r) => <option selected={selectedRepo == r} value={r}>{r}</option>)}
          </select>
        </Row>}
        <Panel style={{ flex: 1 }} />
        <Panel>
          <Row style={{ padding: '8px 12px' }}>
            <div style={{ flex: 1 }}></div>


            <button disabled={!hasScreenshot} type="button" className="btn btn-sm" onClick={() => {
              rpc.request("upload_thumbnail", { repo: selectedRepo, path: file.path, data: dataUrl }).then(() => {
                onClose(true);
              });
            }}>Submit</button>
            <button type="button" style={{ marginLeft: '8px' }} className="btn btn-sm" onClick={() => onClose(false)}>Cancel</button>
          </Row>
        </Panel>
      </div>

    </div >
  );
}

Thumbnailer.propTypes = {
  onClose: PropTypes.func.isRequired,
};
