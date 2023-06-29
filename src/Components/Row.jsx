import { React } from 'react';
import stylePropType from 'react-style-proptype';

import PropTypes from 'prop-types';

export default function Row({ children, style }) {
  return (
    <div className="row" style={style}>{children}</div>
  );
}

Row.propTypes = {
  children: PropTypes.node.isRequired,
  style: stylePropType
};
