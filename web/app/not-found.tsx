import { StatusScreen } from '@/components/shared/status-screen';

export default function NotFound() {
  return (
    <StatusScreen
      kind='empty'
      title='Page not found'
      message='This page does not exist or the link is out of date.'
      action={{ label: 'Home', href: '/' }}
    />
  );
}
