import { React } from 'react';

import PropTypes from 'prop-types';

export default function Row({ children }) {
  return (
    <div className="row">{children}</div>
  );
}

Row.propTypes = {
  children: PropTypes.node.isRequired,
};
