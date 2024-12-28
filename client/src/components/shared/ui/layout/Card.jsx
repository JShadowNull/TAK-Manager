import React from 'react';
import PropTypes from 'prop-types';

function Card({ children, title, className, headerActions }) {
  return (
    <div className={`bg-card p-6 rounded-lg shadow-lg foreground border border-border ${className || ''}`}>
      {(title || headerActions) && (
        <div className="flex justify-between items-center mb-4">
          {title && <h2 className="text-base">{title}</h2>}
          {headerActions && <div className="flex gap-2">{headerActions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

export default Card; 