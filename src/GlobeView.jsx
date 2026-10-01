import { forwardRef, useMemo, useEffect } from 'react';
import ReactGlobe from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';

// Keep the WebGL renderer and its dependencies outside the initial UI bundle.
const GlobeView = forwardRef(function GlobeView(props, ref) {
  const material = useMemo(() => new MeshPhongMaterial({ color: '#081d19', shininess: 9 }), []);
  useEffect(() => () => material.dispose(), [material]);
  return <ReactGlobe {...props} ref={ref} globeMaterial={material} />;
});

export default GlobeView;
