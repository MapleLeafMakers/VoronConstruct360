import { React, useState } from 'react';
import { NodeApi } from 'react-arborist';
import {
  FaChevronDown,
  FaChevronRight,
  FaFolderOpen,
  FaFolder,
  FaCube,
} from 'react-icons/fa';

import PropTypes from 'prop-types';
import stylePropType from 'react-style-proptype';

import clsx from 'clsx';
import rpc from '../rpc';

const is2D = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  return ['dxf', 'svg'].indexOf(ext) !== -1;
};

function NodeIcon({ node }) {
  if (node.isLeaf) {
    return <FaCube />;
  }
  return node.isOpen ? <FaFolderOpen /> : <FaFolder />;
}
NodeIcon.propTypes = {
  node: PropTypes.oneOfType(NodeApi).isRequired,
};

export default function Node({ node, style, dragHandle }) {
  const [importEnabled, setImportEnabled] = useState(true);
  return (
    <div
      ref={dragHandle}
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
      <span style={{ display: 'inline-block', flex: 1 }}>{node.data.name}</span>
      {node.isSelected && node.data.type == 'blob' && (
        <>
          <button
            type="button"
            disabled={!importEnabled}
            onClick={() => {
              setImportEnabled(false);
              setTimeout(() => {
                const ctypes = node.data.content_types;
                const content_type = (ctypes.step && 'step') || (ctypes.f3d && 'f3d') || (ctypes.svg && 'svg') || (ctypes.dxf && 'dxf');
                rpc.request('import_model', { url: ctypes[content_type].url, content_type: content_type }).then(() => {
                  setImportEnabled(true);
                });
              }, 100);
            }}
            className="btn btn-sm"
          >
            Import
          </button>
          <button
            type="button"
            disabled={!importEnabled || is2D(node.data.name)}
            onClick={() => {
              setImportEnabled(false);
              setTimeout(() => {
                const ctypes = node.data.content_types;
                const content_type = (ctypes.f3d && 'f3d') || (ctypes.step && 'step') || (ctypes.svg && 'svg') || (ctypes.dxf && 'dxf');
                rpc.request('open_model', { url: ctypes[content_type].url, content_type: content_type }).then(() => {
                  setImportEnabled(true);
                });
              }, 100);
            }}
            className="btn btn-sm"
          >
            Open New
          </button>

        </>
      )}
    </div>
  );
}
Node.propTypes = {
  node: PropTypes.oneOfType(NodeApi).isRequired,
  style: stylePropType,
  dragHandle: PropTypes.node.isRequired,
};

Node.defaultProps = {
  style: {},
};
