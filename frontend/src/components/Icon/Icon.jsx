import MdiIcon from '@mdi/react';

/**
 * Wrapper de MDI para uso consistente en todo el proyecto.
 * Props:
 *   path: string  — importado de @mdi/js (ej. mdiCrown)
 *   size: number  — en unidades MDI (1 = 24px). Default: 1
 *   color: string — CSS color. Default: "currentColor"
 *   className: string — clase CSS adicional opcional
 */
export default function Icon({ path, size = 1, color = 'currentColor', className }) {
  return (
    <MdiIcon
      path={path}
      size={size}
      color={color}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
}
