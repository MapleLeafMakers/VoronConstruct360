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
      {node.isSelected && node.data.type == 'file' && (
        <>
          <button
            type="button"
            disabled={!importEnabled}
            onClick={() => {
              setImportEnabled(false);
              setTimeout(() => {
                rpc.request('import_model', { url: node.data.download_url }).then(() => {
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
                console.log('Opening', { url: node.data.download_url });
                rpc.request('open_model', { url: node.data.download_url }).then(() => {
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
