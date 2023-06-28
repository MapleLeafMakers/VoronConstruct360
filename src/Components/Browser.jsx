import { React, useEffect, useState } from 'react';
import { Combobox } from 'react-widgets';
import { FaCog, FaPlus, FaCube, FaGithub } from 'react-icons/fa';
import { useWindowSize } from "@uidotdev/usehooks";
import { Tree } from 'react-arborist';
import Settings from './Settings';
import Node from './Node';
import Panel from './Panel';
import Row from './Row';

import rpc from '../rpc';

const sizeOf = (bytes) => {
  if (bytes == 0) { return "0.00 B"; }
  var e = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, e)).toFixed(2) + ' ' + ' KMGTP'.charAt(e) + 'B';
}

const cleanRepos = (repos) => {
  const repoList = repos.split(/[,\s]\s*/).map(r => {
    return r.replace(/\/$/, '').replace(/^(https?:\/\/)?github.com\//, '');
  });
  return repoList.join(',');
};

const repoFromUrl = (url) => {
  const u = new URL(url);
  if (u.pathname.startsWith("/repos/")) {
    return u.pathname.split('/').slice(2, 4).join('/');
  }
  return null;
}
const Thumbnail = ({ file }) => {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    if (file?.content_types?.thumb) {
      rpc.request("get_thumb", { url: file.content_types.thumb.url }).then(result => {
        setDataUrl(result);
      })
    } else {
      setDataUrl(null);
    }
  });
  if (file) {
    return (
      <Panel>
        <Row>
          {dataUrl ? <img src={dataUrl} style={{ maxWidth: 192, maxHeight: 192, objectFit: 'cover' }} /> : <FaCube size={192} style={{ flexShrink: 0 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgb(204,204,204)', paddingLeft: '4px', marginLeft: '4px' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>Path: </span>
              <span>{file.path}</span>
            </div>
            {Object.keys(file.content_types).filter(k => k != 'thumb').map(ct => {
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

export default function Browser() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [repoOptions, setRepoOptions] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [contents, setContents] = useState([]);
  const [repo, setRepo] = useState('');

  const windowSize = useWindowSize();

  useEffect(() => {
    const fetchData = async () => {
      setTimeout(() => {
        rpc.request('get_state', {}).then((state) => {
          setApiKey(state.token);
          setContents(state.repo_list || []);
        }).catch(err => alert(err));
      }, 100);
    }
    fetchData();
  }, []);


  useEffect(() => {
    localStorage.setItem('repo', JSON.stringify(repo));
  }, [repo]);

  const updateRepoList = (newContents) => {
    rpc.request('set_repo_list', { repos: newContents.map(n => ({ ...n, children: [] })) })
  };

  const addRepo = async () => {
    const cleanedRepo = cleanRepos(repo);
    let children;
    try {
      children = await rpc.request("get_repo_tree", { repo: cleanedRepo, token: apiKey });
    } catch (e) {
      alert(e);
      setRepo('');
      return;
    }

    setRepo(cleanedRepo);
    const newContents = [...contents.filter(r => r.id !== cleanedRepo), {
      id: cleanedRepo,
      type: 'repo',
      name: cleanedRepo,
      children: children,
    }];
    setContents(newContents);
    setRepo('');
    updateRepoList(newContents);
  };

  const updateSearch = (search) => {
    setSearchString(search);
  };

  const searchFilter = (node, search) => {
    const tokens = search.toLowerCase().split(/\s+/);
    return tokens.every((t) => node.data.path && node.data.path.toLowerCase().indexOf(t) !== -1);
  };

  return (
    <div id="appwrap">
      <Panel style={{ flex: 0 }}>
        <Row>
          <label htmlFor="search-input">Search </label>
          <input
            id="search-input"
            type="text"
            className="input"
            value={searchString}
            onChange={(event) => {
              updateSearch(event.target.value);
            }}
          />
          <button aria-label="Settings" type="button" style={{ marginLeft: '4px', paddingTop: '4px' }} className="btn" onClick={() => setShowSettings(true)}><FaCog /></button>
        </Row>
      </Panel>
      <Panel style={{ padding: '4px' }}>
        <div className="treeWrap">
          <Tree
            width="100%"
            height={windowSize.height - (64 + (selectedFile ? 200 : 0))}
            searchTerm={searchString}
            searchMatch={searchFilter}
            rowHeight={24}
            data={contents}
            onSelect={(e) => {
              if (e && e.length && e[0]?.data.type == 'blob') {
                console.log("setting selected file to", e[0].data);
                setSelectedFile(e[0].data);
              } else {
                console.log("No selection", e);
                setSelectedFile(null);
              }

            }}
            onDelete={(nodeId) => {
              const newContents = [...contents.filter(r => r['id'] !== nodeId)];
              setContents(newContents);
              updateRepoList(newContents);
            }}
            openByDefault={false}
            indent={16}>{Node}</Tree>
        </div>
        <Row>
          <label htmlFor="repo-input">Add Repository </label>
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
          <button type="button" style={{ marginLeft: '4px' }} className="btn" onClick={addRepo}><FaPlus /></button>
        </Row>
      </Panel >
      <Thumbnail file={selectedFile} />
      {
        showSettings && <Settings
          onClose={() => setShowSettings(false)}
          apiKey={apiKey}
          setApiKey={setApiKey}
          repoOptions={repoOptions}
          setRepoOptions={setRepoOptions}
        />
      }

    </div >
  );
}
