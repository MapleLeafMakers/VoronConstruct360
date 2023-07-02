import { React, useEffect, useState } from 'react';
import { NodeApi } from 'react-arborist';
import { v4 as uuidv4 } from 'uuid';

import {
  FaChevronDown,
  FaChevronRight,
  FaFolderOpen,
  FaFolder,
  FaRedoAlt,
  FaFolderPlus,
  FaUpload,
  FaCube,
  FaGithub,
  FaTrash,
  FaStar,
  FaEdit,
  FaFileImport,
  FaLayerGroup,
} from 'react-icons/fa';

import PropTypes from 'prop-types';
import stylePropType from 'react-style-proptype';

import clsx from 'clsx';
import rpc from '../Helpers/rpc';
import { fileFolderSort } from '../Helpers/repodb';

const is2D = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  return ['dxf', 'svg'].indexOf(ext) !== -1;
};

function NodeIcon({ node }) {
  if (node.isLeaf) {
    return <FaCube />;
  }
  if (node.data.type === 'repo') {
    return <FaGithub />
  }
  return node.isOpen ? <FaFolderOpen /> : <FaFolder />;
}


export default function Node({ node, tree, style }) {
  const [importEnabled, setImportEnabled] = useState(true);
  return (
    <div
      style={style}
      className={clsx(['node', 'row', node.state])}
      onClick={() => node.isInternal && node.toggle()}
    >
      <span style={{ marginRight: '4px' }}>
        {!node.isLeaf && (
          node.isOpen ? <FaChevronDown /> : <FaChevronRight />
        )}
      </span>
      <span style={{ marginRight: '4px' }}>
        <NodeIcon node={node} />
      </span>
      {' '}
      <span style={{ display: 'inline-block', flex: 1, fontWeight: node.data.type === 'repo' ? 'bold' : 'inherit' }}>{node.data.unsaved ? <FaStar style={{ color: '#ffd267' }} /> : ''} {node.data.display_name || node.data.name}</span>
      {node.isSelected && (node.data.type == 'tree' || node.data.type == 'repo') && (
        <>
          <button title="New Folder..." type="button" className="btn btn-sm" onClick={(event) => {
            console.log('children', node.data.children);
            const folderName = prompt("New Folder name:");

            node.data.children.push({ id: `${node.id.split('|')[0]}|${uuidv4()}`, name: folderName, type: 'tree', children: [], path: `${node.data.path}/${folderName}`, unsaved: true });
            node.data.children.sort(fileFolderSort);
            node.data.children = [...node.data.children];
            node.close()
            node.open()
            event.stopPropagation();
          }}><FaFolderPlus /></button>
          <button title="Add active component..." type="button" onClick={(e) => {
            console.log("clicked add on node", node.data)
            tree.props.onUploadModel(node.data.id);
            e.stopPropagation();
          }} className="btn btn-sm"><FaUpload /></button>
        </>
      )}
      {node.isSelected && node.data.type == 'blob' && (
        <>
          <button
            type="button"
            title="Import model to active component"
            disabled={!importEnabled}
            onClick={() => {
              setImportEnabled(false);
              const ctypes = node.data.content_types;
              const content_type = (ctypes.step && 'step') || (ctypes.f3d && 'f3d') || (ctypes.svg && 'svg') || (ctypes.dxf && 'dxf');
              rpc.request('import_model', { url: ctypes[content_type].url, content_type: content_type, token: tree.props.token }).then(() => {
                setImportEnabled(true);
              });
            }}
            className="btn btn-sm"
          >
            <FaFileImport />
          </button>
          <button
            type="button"
            title="Open model as new design"
            disabled={!importEnabled || is2D(node.data.name)}
            onClick={() => {
              setImportEnabled(false);
              const ctypes = node.data.content_types;
              const content_type = (ctypes.f3d && 'f3d') || (ctypes.step && 'step') || (ctypes.svg && 'svg') || (ctypes.dxf && 'dxf');
              rpc.request('open_model', { url: ctypes[content_type].url, content_type: content_type, token: tree.props.token }).then(() => {
                setImportEnabled(true);
              });
            }}
            className="btn btn-sm"
          >
            <FaLayerGroup />
          </button>

        </>
      )}
      {node.isSelected && node.data.type == 'repo' && (
        <>
          <button title="Refresh" type="button" className="btn btn-sm" onClick={(e) => {
            tree.props.onReload(node.data.id);
            e.stopPropagation();
          }}><FaRedoAlt /></button>
          <button type="button" title="Edit..." className="btn btn-sm" onClick={(e) => {
            tree.props.onChange(node.data);
            e.stopPropagation();
          }}><FaEdit /></button>
          <button type="button" title="Delete" className="btn btn-sm danger" onClick={(e) => {
            tree.props.onDelete(node.data.id);
            e.stopPropagation();
          }}><FaTrash /></button>
        </>

      )}
    </div>
  );
}
Node.propTypes = {
  node: PropTypes.object.isRequired,
  style: stylePropType,
  dragHandle: PropTypes.func.isRequired,
};

Node.defaultProps = {
  style: {},
};
