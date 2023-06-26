import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import rpc from './rpc';
import { Tree } from 'react-arborist';
import {FaFolder,FaFolderOpen,FaChevronRight,FaChevronDown,FaCube, FaCog} from "react-icons/fa";
import clsx from 'clsx';
import { SpinnerCircular } from 'spinners-react';
import Combobox from 'react-widgets/Combobox';
import "react-widgets/styles.css";

const is2D = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  return ['dxf', 'svg'].indexOf(ext) !== -1;
}


const Node = ({node, style, dragHandle}) => {
  const [importEnabled, setImportEnabled] = useState(true);
  return (
    <div ref={dragHandle} style={style} className={clsx(['node', 'row', node.state])} onClick={() => node.isInternal && node.toggle()}>
      <span style={{marginRight: '4px'}}>{node.isLeaf ? '' : node.isOpen ? <FaChevronDown /> : <FaChevronRight />}</span>
      <span style={{marginRight: '4px'}}>
        {node.isLeaf ? <FaCube />: node.isOpen ? <FaFolderOpen/> : <FaFolder />}
      </span>{" "}
      <span style={{display: 'inline-block', flex: 1}}>{node.data.name}</span>
      { node.isSelected && node.data.type == 'file' && <>
        <button 
          disabled={!importEnabled}
          onClick={() => {
            setImportEnabled(false);
            setTimeout(() => {
              rpc.request("import_model", {url: node.data.download_url}).then(() => {
                setImportEnabled(true);
              })
            }, 100);          
            }} className="btn btn-sm">
              Import
            </button>
            <button 
              disabled={!importEnabled || is2D(node.data.name)}
              onClick={() => {
                setImportEnabled(false);
                setTimeout(() => {
                  console.log("Opening", {url: node.data.download_url});
                  rpc.request("open_model", {url: node.data.download_url}).then(() => {
                    setImportEnabled(true);
                  })
                }, 100);          
                }} className="btn btn-sm">
                  Open New
            </button>

        </> }
    </div>
  );
}

const Panel = (props) => <div style={props.style} className="panel">{props.children}</div>;
const Row = (props) => <div className="row">{props.children}</div>;

function App() {
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem("apiKey");
    try {
      return JSON.parse(saved);
    } catch (err) {
      return "";
    }
  });
  const [repoOptions, setRepoOptions] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [repo, setRepo] = useState(() => {
    try {
      return JSON.parse(saved);
    } catch (err) {
      return "";
    }
  }); 

  useEffect(() => {
    rpc.request("get_state", {}).then((state) => {
      setApiKey(state.token);
      setRepo(state.repo);
      setRepoOptions(state.repo_options);
    })  
  }, [])

  const loadRepo = () => {
    setLoading(true); // this doesn't work
    setTimeout(() => {
      rpc.request('set_source', { repo: repo, token: apiKey }).then((results) => {
        setContents(results);
        setLoading(false);
      }).catch((err) => {
        alert(err.message);
        setLoading(false);
      })
    }, 100);    
  }

  const promptApiKey = () => {
    const newKey = prompt("Github Personal Access Token", apiKey);
    localStorage.setItem("apiKey", JSON.stringify(newKey));
    setApiKey(newKey);
    
  }

  useEffect(() => {
    localStorage.setItem("repo", JSON.stringify(repo));
  }, [repo]);

  const searchFilter = (node, search) => {
    const tokens = search.toLowerCase().split(/\s+/);
    return tokens.every((t) => node.data.path.toLowerCase().indexOf(t) !== -1)
  };

  return <div id='appwrap'>
    <Panel style={{flex:0}}>
      <Row>
        <label>Repository </label>
        <Combobox data={repoOptions} inputProps={{ className: "input"}} value={repo} onChange={(value) => { 
          setRepo(value);
        }} />
        <button style={{marginLeft: '4px'}} className="btn" onClick={loadRepo}>Load</button>
        <button style={{marginLeft: '4px'}} className="btn" onClick={promptApiKey}><FaCog /></button>
      </Row>
      <Row>
        <label>Search </label>
        <input type="text" className="input" value={searchString} onChange={(event) => { 
          setSearchString(event.target.value);
        }} />
      </Row>
    </Panel>
    <Panel style={{padding:'4px'}}>
      {loading ? 
      <div style={{textAlign: 'center', width: '100%'}}>
        <SpinnerCircular />
      </div>
        
      : <div className='treeWrap'>
          <Tree height={300} width="100%" searchTerm={searchString} searchMatch={searchFilter} data={contents} idAccessor="path" openByDefault={false} indent={16} >{Node}</Tree>
        </div>}
    </Panel>
  </div>;
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);