import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import CustomScrollbar from '../CustomScrollbar';

function TerminalOutput({ 
  lines = [], 
  maxHeight = '300px',
  className = ''
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div 
      className={`bg-black/30 rounded-lg p-4 font-mono text-sm ${className}`}
      style={{ maxHeight }}
    >
      <CustomScrollbar>
        <div ref={scrollRef} className="whitespace-pre-wrap">
          {lines.map((line, index) => (
            <div 
              key={index}
              className="text-textSecondary leading-relaxed"
            >
              {line}
            </div>
          ))}
        </div>
      </CustomScrollbar>
    </div>
  );
}

TerminalOutput.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.string),
  maxHeight: PropTypes.string,
  className: PropTypes.string
};

export default TerminalOutput; 