import { Scrollbars } from 'react-custom-scrollbars-2';

function CustomScrollbar({ children, className = '' }) {
  return (
    <div className={`h-full w-full ${className}`}>
      <Scrollbars
        autoHide
        autoHideTimeout={1000}
        autoHideDuration={200}
        universal={true}
        style={{ width: '100%', height: '100%' }}
        renderThumbVertical={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              backgroundColor: 'rgba(17, 41, 67, 1.000)',
              borderRadius: '8px',
              width: '8px'
            }}
          />
        )}
        renderTrackVertical={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              right: '2px',
              bottom: '2px',
              top: '2px',
              borderRadius: '8px',
              width: '8px'
            }}
          />
        )}
      >
        {children}
      </Scrollbars>
    </div>
  );
}

export default CustomScrollbar; 