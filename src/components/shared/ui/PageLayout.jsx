import React from 'react';
import PropTypes from 'prop-types';

function PageLayout({ children, className }) {
  return (
    <div className={`flex flex-col gap-8 pt-14 ${className || ''}`}>
      {children}
    </div>
  );
}

PageLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default PageLayout; 