import { React } from 'react';
import PropTypes from 'prop-types';
import stylePropType from 'react-style-proptype';

export default function Panel({ style, children }) { return <div style={style} className="panel">{children}</div>; }
Panel.propTypes = { style: stylePropType, children: PropTypes.node.isRequired };
Panel.defaultProps = { style: {} };
