'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getFallbackImage, type ProductDTO } from '@/features/catalog';

export function ProductImage({
  src,
  alt,
  category,
  className,
}: {
  src: string;
  alt: string;
  category: ProductDTO['category'];
  className?: string;
}) {
  const fallback = getFallbackImage(category);
  const [imageSrc, setImageSrc] = useState(src || fallback);

  useEffect(() => {
    setImageSrc(src || fallback);
  }, [fallback, src]);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, 160px"
      className={className}
      onError={() => setImageSrc(fallback)}
    />
  );
}
