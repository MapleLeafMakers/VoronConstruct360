import PropTypes from 'prop-types';
import { React, useRef, useState } from 'react';
import { FaEdit, FaPlus, FaTrash, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import Row from './Row';
import Panel from './Panel';
import { cleanRepoString } from '../Helpers/repodb';

export default function CollectionEditor({ onClose, collection, onChange, token }) {
  const [collectionName, setCollectionName] = useState(collection.display_name);
  const [repos, setRepos] = useState(collection.repositories)
  const [repoError, setRepoError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null)
  const addInputRef = useRef();

  const handleAdd = async () => {
    try {
      const repoData = await cleanRepoString({ input: addInputRef.current.value, token });
      setRepos([...repos, repoData.repr]);
      addInputRef.current.value = '';
      setRepoError('');
    } catch (err) {
      setRepoError(err);
    }
  }

  const handleDelete = () => {
    const copy = [...repos];
    copy.splice(selectedIndex, 1);
    setRepos(copy);
    setSelectedIndex(null);
  }

  const swapPositions = (index1, index2) => {
    const copy = [...repos];
    [copy[index1], copy[index2]] = [copy[index2], copy[index1]];
    setRepos(copy);
  }

  const handleMoveUp = () => swapPositions(selectedIndex, selectedIndex - 1);

  const handleMoveDown = () => swapPositions(selectedIndex, selectedIndex + 1);

  return (
    <div style={{ zIndex: 99999, background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="panel" style={{ zIndex: 99999, minWidth: 200, maxWidth: 400, margin: 'auto' }}>
        <Panel><Row><h3 className="dialog-header"><FaEdit />Collection</h3></Row></Panel>
        <Panel style={{ padding: '8px' }}>
          <Row>
            <label htmlFor="display-name">Display Name </label>

            <input
              id="display-name"
              value={collectionName}
              className='input'
              onChange={(e) => {
                setCollectionName(e.target.value);
              }}
            />

          </Row>
          <Row>
            <label htmlFor="repo-input">Repositories </label>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'row', flex: 1, margin: '2px 0px' }}>
                <input placeholder="<owner>/<repo>[/<path>][#<branch>]" ref={addInputRef} type="text" id="add-input" className="input"
                  onChange={() => {
                    setRepoError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.code === 'Enter') {
                      handleAdd();
                    }
                  }} />
                <button type="button" className="btn btn-sm btn-addon"><FaPlus size={12} onClick={handleAdd} /></button>
              </div>
              {repoError && <span style={{ color: 'red' }}>{repoError}</span>}
              <select id="repo-input" className="input" multiple={true} onChange={(event) => {
                setSelectedIndex(event.target.selectedIndex);
              }}>
                {repos.map((r, i) => <option key={r}>
                  {r}
                </option>)}
              </select>
              <div className="btn-group">
                <button onClick={handleDelete} disabled={selectedIndex === null} className="btn btn-sm" type="button"><FaTrash /></button>
                <button onClick={handleMoveUp} disabled={selectedIndex === null || selectedIndex === 0} className="btn btn-sm" type="button"><FaArrowUp /></button>
                <button onClick={handleMoveDown} disabled={selectedIndex === null || selectedIndex === repos.length - 1} className="btn btn-sm" type="button"><FaArrowDown /></button>
              </div>
            </div>

          </Row>
        </Panel>
        <Panel style={{ flex: 1 }} />
        <Panel>
          <Row style={{ padding: '8px 12px', justifyContent: 'flex-end' }}>
            <button type="button" style={{ marginRight: '8px' }} className="btn btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-sm" onClick={() => onChange({ ...collection, repositories: repos, display_name: collectionName })}>Save Changes</button>
          </Row>
        </Panel>
      </div>
    </div >
  );
}

CollectionEditor.propTypes = {
  onClose: PropTypes.func.isRequired,
};
