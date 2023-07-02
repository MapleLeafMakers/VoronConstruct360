import PropTypes from 'prop-types';
import { React, useEffect, useState } from 'react';
import { FaCube, FaCamera } from 'react-icons/fa';
import { downloadBlobImageAsDataUri, uploadThumbnail } from '../Helpers/repodb';
import rpc from '../Helpers/rpc';
import Row from './Row';
import Panel from './Panel';


export default function Thumbnailer({ file, onClose, token, collection }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [hasScreenshot, setHasScreenshot] = useState(false);
  console.log(collection);
  const allRepos = [...collection.repositories];
  const [selectedRepo, setSelectedRepo] = useState(allRepos[0]);

  useEffect(() => {
    if (file?.content_types?.thumb) {
      downloadBlobImageAsDataUri({ url: file.content_types.thumb.url, token: token }).then(result => {
        setDataUrl(result);
      });
    } else {
      setDataUrl(null);
    }
  }, [file]);

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
            <button type="button" style={{ marginRight: '8px' }} className="btn btn-sm" onClick={() => onClose(false)}>Cancel</button>
            <button disabled={!hasScreenshot} type="button" className="btn btn-sm" onClick={() => {
              let [repoPath, branch] = selectedRepo.split('#');
              let repo = repoPath.split('/').slice(0, 2).join('/');
              let path = file.path;
              let data = dataUrl.substring('data:image/png;base64,'.length);
              let sha = file?.content_types?.thumb?.url;
              if (sha) {
                sha = sha.split('/').pop();
              }
              uploadThumbnail({ repo, path, branch, data, token, sha }).then(() => {
                onClose(true);
              })
            }}>Submit</button>
          </Row>
        </Panel>
      </div>
    </div>
  );
}

Thumbnailer.propTypes = {
  onClose: PropTypes.func.isRequired,
};
