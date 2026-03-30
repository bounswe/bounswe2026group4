import React from 'react';
import { render } from '@testing-library/react-native';
import { Skeleton, SkeletonCard, SkeletonPage } from '../LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders Skeleton without crashing', () => {
    const { toJSON } = render(<Skeleton />);

    expect(toJSON()).toBeTruthy();
  });

  it('renders SkeletonCard without crashing', () => {
    const { toJSON } = render(<SkeletonCard />);

    expect(toJSON()).toBeTruthy();
  });

  it('renders SkeletonPage without crashing', () => {
    const { toJSON } = render(<SkeletonPage />);

    expect(toJSON()).toBeTruthy();
  });
});
