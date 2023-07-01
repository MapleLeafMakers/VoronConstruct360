import { useState, useEffect, React } from 'react';
import { FaCube, FaGithub } from 'react-icons/fa';
import Panel from './Panel';
import Row from './Row';
import { blobUrlToDataUrl } from '../Helpers/repodb';

const sizeOf = (bytes) => {
  if (bytes == 0) { return "0.00 B"; }
  var e = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, e)).toFixed(2) + ' ' + ' KMGTP'.charAt(e) + 'B';
}


const repoFromUrl = (url) => {
  const u = new URL(url);
  if (u.pathname.startsWith("/repos/")) {
    return u.pathname.split('/').slice(2, 4).join('/');
  }
  return null;
}


export default function Preview({ file, onClickImage, token }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!file?.meta?.thumb && file?.content_types?.thumb) {
      blobUrlToDataUrl({ blobUrl: file.content_types.thumb.url, token: token }).then(result => {
        setDataUrl(result);
      });
    } else if (file?.meta?.thumb) {
      setDataUrl(file.meta.thumb);
    } else {
      setDataUrl(null);
    }
  }, [file]);
  if (file) {
    return (
      <Panel>
        <Row>
          <div onClick={onClickImage}>
            {dataUrl ? <img src={dataUrl} style={{ maxWidth: 192, maxHeight: 192, objectFit: 'cover' }} /> : <FaCube size={192} style={{ flexShrink: 0 }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgb(204,204,204)', paddingLeft: '4px', marginLeft: '4px' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>Path: </span>
              <span>{file.path}</span>
            </div>
            {file?.meta?.keywords && <div>
              <span style={{ fontWeight: 'bold' }}>Keywords: </span>
              <span>{file.meta.keywords}</span>
            </div>}
            <hr />
            {Object.keys(file.content_types).filter(k => k != 'thumb' && k != 'meta').map(ct => {
              const repo = repoFromUrl(file.content_types[ct].url);
              return (<div>
                <span style={{ fontWeight: 'bold' }}>{ct}: </span>
                <span>{sizeOf(file.content_types[ct].size)} [<FaGithub style={{ verticalAlign: 'top' }} /> {repo}]</span>
              </div>)
            })}

          </div>
        </Row>
      </Panel>
    );
  }
  return <div></div>;
}
