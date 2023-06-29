import { React, useEffect, useState, useRef } from 'react';
import { Combobox } from 'react-widgets';
import { FaCog, FaPlus, FaCube, FaGithub } from 'react-icons/fa';
import { useWindowSize } from "@uidotdev/usehooks";
import { Tree } from 'react-arborist';
import Settings from './Settings';
import Node from './Node';
import Panel from './Panel';
import Row from './Row';
import Preview from './Preview';
import Thumbnailer from './Thumbnailer';
import rpc from '../rpc';



const cleanRepos = (repos) => {
  const repoList = repos.split(/[,\s]\s*/).map(r => {
    return r.replace(/\/$/, '').replace(/^(https?:\/\/)?github.com\//, '');
  });
  return repoList.join(',');
};


export default function Browser() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showThumbnailer, setShowThumbnailer] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [repoOptions, setRepoOptions] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [contents, setContents] = useState([]);
  const [repo, setRepo] = useState('');
  const tree = useRef();

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

  const newContents = [];

  const reloadRepo = async (repo) => {
    for (let r of contents) {
      if (r.id != repo) {
        newContents.push({ ...r });
      } else {
        newContents.push({
          ...r,
          children: await rpc.request("get_repo_tree", { repo, token: apiKey })
        })
      }

    }
    setContents(newContents);
  }

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
            ref={tree}
            width="100%"
            height={windowSize.height - (64 + (selectedFile ? 200 : 0))}
            searchTerm={searchString}
            searchMatch={searchFilter}
            rowHeight={24}
            data={contents}
            onChange={reloadRepo}
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
      <Preview file={selectedFile} onClickImage={() => setShowThumbnailer(true)} />
      {
        showSettings && <Settings
          onClose={() => setShowSettings(false)}
          apiKey={apiKey}
          setApiKey={setApiKey}
          repoOptions={repoOptions}
          setRepoOptions={setRepoOptions}
        />
      }
      {
        showThumbnailer && <Thumbnailer
          file={selectedFile}
          onClose={
            (updated) => {
              console.log('updated', updated);
              setShowThumbnailer(false);
              if (updated) {
                const repoId = selectedFile.id.split('|')[0];
                reloadRepo(repoId);
              }
            }
          } />
      }

    </div >
  );
}
