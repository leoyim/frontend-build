import Content from '@theme-original/DocItem/Content';
import ViewSource from '@site/src/components/ViewSource';
import type {ReactNode} from 'react';
interface Props {
  children: ReactNode;
}
export default function ContentWrapper(props: Props): ReactNode {
  return (
    <ViewSource>
      <Content {...props} />
    </ViewSource>
  );
}