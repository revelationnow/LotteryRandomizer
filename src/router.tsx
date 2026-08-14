import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

/**
 * A hash router, in about forty lines.
 *
 * react-router was by some distance the second-largest thing in the bundle, for
 * an app with three tabs and no nested routes, loaders, or params. Hash routing
 * also means no server rewrite rules are needed on any static host.
 */

function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    // The hash may have changed between first render and this effect running.
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return path;
}

export function navigate(to: string, replace = false) {
  const target = `#${to}`;
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <a href={`#${to}`} {...rest}>
      {children}
    </a>
  );
}

interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> {
  to: string;
  className?: string | ((state: { isActive: boolean }) => string);
  children: ReactNode | ((state: { isActive: boolean }) => ReactNode);
}

/** A Link that knows whether it points at the current route. */
export function NavLink({ to, className, children, ...rest }: NavLinkProps) {
  const path = useRoute();
  const isActive = path === to;
  return (
    <a
      href={`#${to}`}
      aria-current={isActive ? 'page' : undefined}
      className={typeof className === 'function' ? className({ isActive }) : className}
      {...rest}
    >
      {typeof children === 'function' ? children({ isActive }) : children}
    </a>
  );
}
