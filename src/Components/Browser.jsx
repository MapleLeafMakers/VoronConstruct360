import { React, useEffect, useState, useRef } from 'react';
import { FaCog, FaPlus } from 'react-icons/fa';
import { useWindowSize } from "@uidotdev/usehooks";
import { Tree } from 'react-arborist';
import { getMergedTrees, setCache, cleanRepoString } from '../Helpers/repodb';
import { v4 as uuidv4 } from 'uuid';
import { SpinnerCircular } from 'spinners-react';
import Settings from './Settings';
import Node from './Node';
import Panel from './Panel';
import Row from './Row';
import Preview from './Preview';
import Thumbnailer from './Thumbnailer';
import CollectionEditor from './CollectionEditor';
import ModelUploader from './ModelUploader';
import rpc from '../Helpers/rpc';


const cleanRepos = async (repos, token) => {
  console.log('cleanRepos(', repos, token, ')');
  const repoList = await Promise.all(repos.split(/[,\s]\s*/).map(async (r) => {
    try {
      const repoData = await cleanRepoString({ input: r, token });
      return repoData.repr;
    } catch (err) {
      alert(err);
      throw err;
    }
  }));
  return repoList.filter(r => r !== null).join(',');
};

setCache({
  async get(key, defaultValue) {
    let value = await rpc.request("kv_get", { key });
    if (value === null) {
      value = defaultValue;
    }
    return value;
  },

  async set(key, value) {
    return await rpc.request("kv_set", { key, value });
  }
});

export default function Browser() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showThumbnailer, setShowThumbnailer] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [repoOptions, setRepoOptions] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [contents, setContents] = useState([]);
  const [selectedRoot, setSelectedRoot] = useState(null)
  const [repo, setRepo] = useState('');
  const [showCollectionEditor, setShowCollectionEditor] = useState(false);
  const [showModelUploader, setShowModelUploader] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [loadingRepos, setLoadingRepos] = useState(false)
  const tree = useRef();

  const windowSize = useWindowSize();

  useEffect(() => {
    setLoadingRepos(true);
    const fetchData = async () => {
      rpc.request('kv_mget', { keys: ['token', 'collections'] }).then(({ collections, token }) => {
        collections = collections || [];
        setApiKey(token || '');
        Promise.all(collections.map(async (c) => {
          c.children = await getMergedTrees({ repositories: c.repositories, token: token, id_prefix: c.id, index: true });
          return c;
        })).then((result) => {
          setContents(result);
          setLoadingRepos(false);
        });
      }).catch(err => {
        alert(err);
        setLoadingRepos(false);
      });
    }
    fetchData();
  }, []);

  const updateRepoList = (newContents) => {
    rpc.request('kv_set', { key: 'collections', value: newContents.map(n => ({ ...n, children: [] })) })
  };

  const reloadCollection = async (collection) => {
    const newContents = [];
    for (let r of contents) {
      if (r.id != collection.id) {
        newContents.push({ ...r });
      } else {
        newContents.push({
          ...r,
          children: await getMergedTrees({ repositories: collection.repositories, token: apiKey, id_prefix: collection.id, index: true }),
        })
      }
    }
    setContents(newContents);
  }

  const addRepo = async () => {
    const cleanedRepo = await cleanRepos(repo, apiKey);
    const _id = uuidv4();
    const newContents = [...contents, {
      id: _id,
      display_name: cleanedRepo,
      repositories: cleanedRepo.split(','),
      type: 'repo',
      name: cleanedRepo,
      children: await getMergedTrees({ repositories: cleanedRepo.split(','), token: apiKey, id_prefix: _id, index: true }),
    }];
    setContents(newContents);
    setRepo('');
    updateRepoList(newContents);
  };

  const updateSearch = (search) => {
    setSearchString(search);
  };

  const handleEditCollection = (collection) => {
    setEditingCollection(collection);
    setShowCollectionEditor(true);
  }

  const searchFilter = (node, search) => {
    const tokens = search.toLowerCase().split(/\s+/);
    return tokens.every((t) => {
      return ((node.data.meta && node.data.meta.keywords && node.data.meta.keywords.indexOf(t) !== -1) ||
        (node.data.path && node.data.path.toLowerCase().indexOf(t) !== -1))
    });
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
      {loadingRepos ?
        <Panel style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'center' }}><SpinnerCircular /></Panel> :
        <Panel style={{ padding: '4px' }}>
          <div className="treeWrap">
            <Tree
              ref={tree}
              width="100%"
              height={windowSize.height - (64 + (selectedFile ? 200 : 0))}
              searchTerm={searchString}
              searchMatch={searchFilter}
              rowHeight={24}
              token={apiKey}
              data={contents}
              onUploadModel={(nodeId) => {
                console.log("Upload model to", nodeId);
                setShowModelUploader(true);
              }}
              onReload={(collectionId) => reloadCollection(contents.filter(c => c.id == collectionId)[0])}
              onChange={handleEditCollection}
              onSelect={(e) => {
                if (e && e.length && e[0]?.data.type == 'blob') {
                  setSelectedFile(e[0].data);
                  setSelectedFolder(null);
                  setSelectedRoot(e[0].data.id.split('|')[0])
                } else if (e && e.length && e[0].data.type == 'tree') {
                  setSelectedFile(null);
                  setSelectedFolder(e[0].data);
                  setSelectedRoot(e[0].data.id.split('|')[0]);
                } else if (e && e.length && e[0].data.type == 'repo') {
                  setSelectedFile(null);
                  setSelectedRoot(e[0].data.id);
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
            <label htmlFor="repo-input">Add repository </label>
            <input
              className="input"
              style={{ flex: 1 }}
              value={repo}
              onChange={(event) => {
                setRepo(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.code == 'Enter') {
                  addRepo();
                }
              }}
            />
            <button type="button" className="btn" onClick={addRepo}><FaPlus /></button>
          </Row>
        </Panel>}
      <Preview token={apiKey} file={selectedFile} onClickImage={() => setShowThumbnailer(true)} />
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
          token={apiKey}
          collection={contents.filter(r => r.id === selectedRoot)[0]}
          file={selectedFile}
          onClose={
            (updated) => {
              setShowThumbnailer(false);
              if (updated) {
                const repoId = selectedFile.id.split('|')[0];
                reloadCollection(repoId);
              }
            }
          } />
      }
      {
        showCollectionEditor && editingCollection && <CollectionEditor
          token={apiKey}
          collection={editingCollection}
          onChange={(newCollection) => {
            const newContents = [...contents];
            newContents.splice(contents.indexOf(editingCollection), 1, newCollection);
            setContents(newContents);
            setEditingCollection(null);
            updateRepoList(newContents);
          }}
          onClose={() => {
            setEditingCollection(null);
            setShowCollectionEditor(false);
          }} />
      }
      {showModelUploader && <ModelUploader
        token={apiKey}
        path={selectedFolder.path}
        collection={contents.filter(r => r.id === selectedRoot)[0]}
        onClose={
          (updated) => {
            setShowModelUploader(false);
            if (updated) {
              reloadCollection(contents.filter(r => r.id === selectedRoot)[0]);
            }
          }
        } />
      }
    </div >
  );
}
