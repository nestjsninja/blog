export interface Author {
  name: string;
  picture: string;
}

export interface CoverImageCredit {
  photographerName: string;
  photographerUrl: string;
  sourceUrl: string;
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  coverImage: string;
  coverImageCredit?: CoverImageCredit;
  author: Author;
  ogImage: {
    url: string;
  };
  tags?: string[];
  content: string;
}
