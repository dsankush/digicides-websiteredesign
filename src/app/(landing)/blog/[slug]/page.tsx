"use client";

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Blog, BlogComment } from '@/types/blog';
import { 
  fetchBlog, fetchBlogs, checkLikeStatus, toggleLike, 
  fetchComments, submitComment, generateFingerprint 
} from '@/lib/blog-storage';
import { 
  Clock, Calendar, Tag, ArrowLeft, Share2, ChevronRight, 
  FileText, Loader2, Heart, MessageSquare, Send, CheckCircle
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BlogPostPage({ params }: PageProps) {
  const { slug } = use(params);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<Blog[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Like state
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  
  // Comment state
  const [commentName, setCommentName] = useState('');
  const [commentEmail, setCommentEmail] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentMessage, setCommentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generate fingerprint on mount
  useEffect(() => {
    const fp = generateFingerprint();
    setFingerprint(fp);
  }, []);

  // Load blog
  useEffect(() => {
    const loadBlog = async () => {
      setIsLoading(true);
      
      try {
        const foundBlog = await fetchBlog(slug);
        
        if (foundBlog && foundBlog.status === 'published') {
          setBlog(foundBlog);
          setLikesCount(foundBlog.likesCount || 0);
          
          // Load related blogs
          const allBlogs = await fetchBlogs('published');
          const related = allBlogs
            .filter(b => 
              b.id !== foundBlog.id && 
              (b.category === foundBlog.category || 
               b.tags.some(tag => foundBlog.tags.includes(tag)))
            )
            .slice(0, 3);
          setRelatedBlogs(related);
          
          // Load comments
          const blogComments = await fetchComments(foundBlog.id);
          setComments(blogComments);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error('Error loading blog:', error);
        setNotFound(true);
      }
      
      setIsLoading(false);
    };

    void loadBlog();
  }, [slug]);

  // Check like status
  useEffect(() => {
    if (blog && fingerprint) {
      void checkLikeStatus(blog.id, fingerprint).then(({ hasLiked, likesCount }) => {
        setHasLiked(hasLiked);
        setLikesCount(likesCount);
      });
    }
  }, [blog, fingerprint]);

  // Handle like
  const handleLike = async () => {
    if (!blog || !fingerprint || isLiking) return;
    
    setIsLiking(true);
    const result = await toggleLike(blog.id, fingerprint);
    setHasLiked(result.hasLiked);
    setLikesCount(result.likesCount);
    setIsLiking(false);
  };

  // Handle comment submit
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blog || isSubmitting) return;
    
    if (!commentName.trim() || !commentContent.trim()) {
      setCommentMessage({ type: 'error', text: 'Name and comment are required' });
      return;
    }
    
    setIsSubmitting(true);
    setCommentMessage(null);
    
    const result = await submitComment(
      blog.id, 
      commentName.trim(), 
      commentContent.trim(),
      commentEmail.trim() || undefined
    );
    
    if (result.success) {
      setCommentMessage({ type: 'success', text: result.message });
      setCommentName('');
      setCommentEmail('');
      setCommentContent('');
    } else {
      setCommentMessage({ type: 'error', text: result.message });
    }
    
    setIsSubmitting(false);
  };

  // Share
  const handleShare = async () => {
    if (navigator.share && blog) {
      try {
        await navigator.share({
          title: blog.title,
          text: blog.subtitle || blog.title,
          url: window.location.href,
        });
      } catch {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !blog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText size={64} className="mx-auto text-gray-300 mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-4">Blog Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The blog post you&apos;re looking for doesn&apos;t exist or has been unpublished.
          </p>
          <Link href="/blog">
            <Button>Back to Blog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="container mx-auto max-w-4xl px-4 pt-28">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight size={14} />
          <Link href="/blog" className="hover:text-primary transition-colors">Blog</Link>
          <ChevronRight size={14} />
          <span className="text-foreground truncate max-w-[200px]">{blog.title}</span>
        </nav>
      </div>

      {/* Header */}
      <header className="container mx-auto max-w-4xl px-4 pb-8">
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
          {blog.category && (
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
              {blog.category}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {blog.readingTime} min read
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {new Date(blog.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
          {blog.title}
        </h1>

        {blog.subtitle && (
          <p className="text-xl text-muted-foreground mb-6">{blog.subtitle}</p>
        )}

        {blog.author && (
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
              {blog.author.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{blog.author}</p>
              <p className="text-sm text-muted-foreground">Author</p>
            </div>
          </div>
        )}
      </header>

      {/* Featured Image */}
      {blog.thumbnail && (
        <div className="container mx-auto max-w-5xl px-4 mb-12">
          <div className="relative aspect-[2/1] rounded-2xl overflow-hidden shadow-lg">
            <Image src={blog.thumbnail} alt={blog.title} fill className="object-cover" priority />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 pb-12">
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />
        <style jsx global>{`
          .blog-content {
            font-size: 1.125rem;
            line-height: 1.8;
            color: #1a1a1a;
          }
          .blog-content h1 {
            font-size: 2rem;
            font-weight: 700;
            margin: 2.5rem 0 1rem;
            color: #1a1a1a;
          }
          .blog-content h2 {
            font-size: 1.75rem;
            font-weight: 700;
            margin: 2rem 0 1rem;
            color: #1a1a1a;
          }
          .blog-content h3 {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 1.5rem 0 0.75rem;
            color: #1a1a1a;
          }
          .blog-content p {
            margin-bottom: 1.25rem;
            line-height: 1.8;
          }
          .blog-content a {
            color: #E07B39;
            text-decoration: none;
          }
          .blog-content a:hover {
            text-decoration: underline;
          }
          .blog-content strong {
            font-weight: 600;
          }
          .blog-content ul {
            list-style: disc;
            padding-left: 1.5rem;
            margin: 1rem 0;
          }
          .blog-content ol {
            list-style: decimal;
            padding-left: 1.5rem;
            margin: 1rem 0;
          }
          .blog-content li {
            margin-bottom: 0.5rem;
          }
          .blog-content blockquote {
            border-left: 4px solid #E07B39;
            padding: 1rem 1.5rem;
            margin: 1.5rem 0;
            background: #FEF4E8;
            border-radius: 0 12px 12px 0;
            font-style: italic;
          }
          .blog-content code {
            background: #f3f4f6;
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
            font-size: 0.875em;
            font-family: monospace;
          }
          .blog-content pre {
            background: #1f2937;
            color: #f3f4f6;
            padding: 1.5rem;
            border-radius: 12px;
            overflow-x: auto;
            margin: 1.5rem 0;
          }
          .blog-content pre code {
            background: transparent;
            padding: 0;
            color: inherit;
          }
          /* IMAGE FIXES - Full width, no cutoff */
          .blog-content img {
            max-width: 100%;
            width: auto;
            height: auto;
            display: block;
            margin: 1.5rem auto;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .blog-content figure {
            margin: 1.5rem 0;
            text-align: center;
          }
          .blog-content figure img {
            margin: 0 auto 0.5rem;
          }
          .blog-content figcaption {
            font-size: 0.875rem;
            color: #666;
          }
          /* VIDEO FIXES - Full width, responsive */
          .blog-content video {
            max-width: 100%;
            width: 100%;
            height: auto;
            display: block;
            margin: 1.5rem 0;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          /* IFRAME/EMBED FIXES - YouTube, Vimeo etc */
          .blog-content iframe {
            max-width: 100%;
            width: 100%;
            border-radius: 12px;
            margin: 1.5rem 0;
          }
          .blog-content div[style*="padding-bottom: 56.25%"],
          .blog-content div[style*="padding-bottom:56.25%"],
          .blog-content .video-container {
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
            max-width: 100%;
            margin: 1.5rem 0;
            border-radius: 12px;
            background: #000;
          }
          .blog-content div[style*="padding-bottom: 56.25%"] iframe,
          .blog-content div[style*="padding-bottom:56.25%"] iframe,
          .blog-content .video-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 12px;
            margin: 0;
          }
          /* TABLE STYLING */
          .blog-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            overflow: hidden;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .blog-content th, .blog-content td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          .blog-content th {
            background: #f9fafb;
            font-weight: 600;
          }
          .blog-content tr:last-child td {
            border-bottom: none;
          }
          /* HR STYLING */
          .blog-content hr {
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 2rem 0;
          }
          /* RESPONSIVE */
          @media (max-width: 768px) {
            .blog-content {
              font-size: 1rem;
            }
            .blog-content h1 {
              font-size: 1.75rem;
            }
            .blog-content h2 {
              font-size: 1.5rem;
            }
            .blog-content h3 {
              font-size: 1.25rem;
            }
          }
        `}</style>
      </div>

      {/* Tags */}
      {blog.tags.length > 0 && (
        <div className="container mx-auto max-w-4xl px-4 pb-12">
          <div className="flex items-center gap-3 flex-wrap pt-6 border-t">
            <span className="flex items-center gap-2 text-muted-foreground font-medium">
              <Tag size={18} />
              Tags:
            </span>
            {blog.tags.map((tag, idx) => (
              <span key={idx} className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Like & Share Section */}
      <div className="container mx-auto max-w-4xl px-4 pb-12">
        <div className="flex items-center justify-between py-6 border-t border-b bg-gray-50 rounded-2xl px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => void handleLike()}
              disabled={isLiking}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                hasLiked 
                  ? 'bg-pink-100 text-pink-600 hover:bg-pink-200' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Heart size={20} fill={hasLiked ? 'currentColor' : 'none'} />
              <span>{likesCount}</span>
              <span className="hidden sm:inline">{hasLiked ? 'Liked' : 'Like'}</span>
            </button>
            
            <span className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare size={20} />
              {comments.length} comments
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/blog">
              <Button variant="outline" className="gap-2">
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>

            <Button variant="outline" className="gap-2" onClick={() => void handleShare()}>
              <Share2 size={16} />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="container mx-auto max-w-4xl px-4 pb-16">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <MessageSquare size={24} />
          Comments ({comments.length})
        </h2>

        {/* Comment Form */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
          <h3 className="font-semibold text-foreground mb-4">Leave a Comment</h3>
          
          {commentMessage && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
              commentMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {commentMessage.type === 'success' ? <CheckCircle size={18} /> : <MessageSquare size={18} />}
              {commentMessage.text}
            </div>
          )}
          
          <form onSubmit={(e) => void handleCommentSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={commentName}
                  onChange={(e) => setCommentName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full px-4 py-3 rounded-lg border bg-gray-50 focus:bg-white focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={commentEmail}
                  onChange={(e) => setCommentEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-lg border bg-gray-50 focus:bg-white focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Comment *
              </label>
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Write your comment here..."
                required
                rows={4}
                maxLength={1000}
                className="w-full px-4 py-3 rounded-lg border bg-gray-50 focus:bg-white focus:border-primary outline-none transition-all resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {commentContent.length}/1000 characters
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Your comment will be visible after approval.
              </p>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Submit
              </Button>
            </div>
          </form>
        </div>

        {/* Comments List */}
        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {comment.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground">{comment.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
          </div>
        )}
      </div>

      {/* Related Posts */}
      {relatedBlogs.length > 0 && (
        <section className="bg-[#FEF4E8] py-16">
          <div className="container mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
              Related Articles
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {relatedBlogs.map((relatedBlog) => (
                <Link key={relatedBlog.id} href={`/blog/${relatedBlog.slug}`}>
                  <article className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden h-full">
                    <div className="relative h-40 overflow-hidden">
                      {relatedBlog.thumbnail ? (
                        <Image
                          src={relatedBlog.thumbnail}
                          alt={relatedBlog.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        {relatedBlog.category && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                            {relatedBlog.category}
                          </span>
                        )}
                        <span>{relatedBlog.readingTime} min</span>
                      </div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {relatedBlog.title}
                      </h3>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Want to Discuss Agri Marketing Strategies?
          </h2>
          <p className="text-muted-foreground mb-6">
            Our team is ready to help your brand connect with farmers across India.
          </p>
          <Link href="/#contact-us">
            <Button size="lg">Contact Us</Button>
          </Link>
        </div>
      </section>
    </article>
  );
}
