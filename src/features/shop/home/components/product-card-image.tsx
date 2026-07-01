"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  getFallbackImage,
  type ProductDTO,
} from "@/features/catalog";

export type ProductCardImageProps = {
  product: ProductDTO;
};

export function ProductCardImage({ product }: ProductCardImageProps) {
  const fallback = getFallbackImage(product.category);
  const [imageSrc, setImageSrc] = useState(product.image || fallback);

  useEffect(() => {
    setImageSrc(product.image || fallback);
  }, [fallback, product.image]);

  return (
    <Image
      src={imageSrc}
      alt={product.name}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className="object-cover group-hover:scale-110 transition duration-500"
      onError={() => setImageSrc(fallback)}
    />
  );
}
