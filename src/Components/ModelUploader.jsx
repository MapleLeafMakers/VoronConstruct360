
import PropTypes from 'prop-types';
import { React, useEffect, useState } from 'react';
import { FaCube, FaCamera } from 'react-icons/fa';
import { uploadFiles } from '../Helpers/repodb';
import rpc from '../Helpers/rpc';
import Row from './Row';
import Panel from './Panel';

export default function ModelUploader({ onClose, token, collection, path }) {
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const [componentName, setComponentName] = useState('');
  const [includeThumbnail, setIncludeThumbnail] = useState(true);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
  const [includeStep, setIncludeStep] = useState(true);
  const [includeF3d, setIncludeF3d] = useState(true);
  const allRepos = [...collection.repositories];
  const [selectedRepo, setSelectedRepo] = useState(allRepos[0]);

  useEffect(() => {
    rpc.request("export_model", { f3d: false, step: false }).then(result => {
      setComponentName(result.name);
    });
  }, []);

  const handleSubmit = () => {
    rpc.request("export_model", { f3d: includeF3d, step: includeStep }).then(result => {
      let [repoPath, branch] = selectedRepo.split('#');
      let repo = repoPath.split('/').slice(0, 2).join('/');
      let files = [];
      if (includeStep) {
        files.push({
          path: `${path}/${componentName}.step`,
          content: result.step.split(',')[1],
          encoding: 'base64',
        })
      }
      if (includeF3d) {
        files.push({
          path: `${path}/${componentName}.f3d`,
          content: result.f3d.split(',')[1],
          encoding: 'base64',
        })
      }
      if (includeThumbnail) {
        files.push({
          path: `${path}/${componentName}.png`,
          content: thumbnailDataUrl.split(',')[1],
          encoding: 'base64',
        })
      }
      uploadFiles({ repo, branch, token, files, message: `Add ${path}/${componentName}` }).then(() => {
        onClose(true);
      }).catch(err => {
        alert(err);
      });
    });
  }

  return (
    <div style={{ zIndex: 99999, background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="panel" style={{ zIndex: 99999, minWidth: 200, maxWidth: 400, margin: 'auto' }}>
        <Panel>
          <Row><label>Component Name </label><input type="text" className="input" value={componentName} onChange={(e) => setComponentName(e.target.value)} /></Row>
        </Panel>
        <Panel>
          <Row><label><input type="checkbox" checked={includeStep} onChange={(e) => setIncludeStep(!includeStep)} /> Include STEP</label></Row>
        </Panel>
        <Panel>
          <Row><label><input type="checkbox" checked={includeF3d} onChange={(e) => setIncludeF3d(!includeF3d)} /> Include F3D</label></Row>
        </Panel>
        <Panel>
          <Row><label><input type="checkbox" checked={includeThumbnail} onChange={(e) => setIncludeThumbnail(!includeThumbnail)} /> Include Thumbnail</label></Row>
          {includeThumbnail && (
            <>
              {thumbnailDataUrl ? <img src={thumbnailDataUrl} style={{ maxWidth: 256, maxHeight: 256, margin: 'auto', objectFit: 'cover' }} />
                : <FaCube size={256} style={{ margin: 'auto' }} />}
              <Row style={{ justifyContent: 'center' }}>
                <button onClick={() => {
                  rpc.request("get_screenshot").then(setThumbnailDataUrl).then(() => setHasScreenshot(true));
                }} type="button" className="btn"><FaCamera style={{ verticalAlign: 'text-top' }} /> Screenshot</button>
              </Row>
            </>
          )}
        </Panel>
        <Panel>
          <Row>
            <label>Upload to </label>
            <select className='input' onChange={(e) => {
              setSelectedRepo(e.target.value);
            }}>
              {allRepos.map((r) => <option selected={selectedRepo == r} value={r}>{r}</option>)}
            </select>
          </Row>
        </Panel>
        <Panel style={{ flex: 1 }} />
        <Panel>
          <Row style={{ padding: '8px 12px' }}>
            <div style={{ flex: 1 }}></div>
            <button type="button" style={{ marginRight: '8px' }} className="btn btn-sm" onClick={() => onClose(false)}>Cancel</button>
            <button disabled={!hasScreenshot} type="button" className="btn btn-sm" onClick={handleSubmit}>Submit</button>
          </Row>
        </Panel>
      </div>
    </div>
  );
}

ModelUploader.propTypes = {
  onClose: PropTypes.func.isRequired,
};