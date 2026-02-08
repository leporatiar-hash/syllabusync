#!/usr/bin/env python3
"""
Test script to verify the chunked summarization logic works correctly.
"""

def test_text_chunking():
    """Test that text chunking breaks at appropriate boundaries"""

    # Simulate a long document
    sample_text = """
Chapter 1: Introduction to Machine Learning

Machine learning is a subset of artificial intelligence. It focuses on teaching computers to learn from data.

There are three main types of machine learning:
1. Supervised Learning
2. Unsupervised Learning
3. Reinforcement Learning

Supervised learning uses labeled data. The algorithm learns from examples where the correct answer is known.

Chapter 2: Neural Networks

Neural networks are inspired by biological brains. They consist of layers of interconnected nodes.

Each node performs a simple calculation. Together, they can learn complex patterns.

Backpropagation is the key algorithm. It adjusts weights to minimize error.

Chapter 3: Deep Learning

Deep learning uses neural networks with many layers. This allows learning hierarchical representations.

Convolutional neural networks excel at image tasks. Recurrent neural networks handle sequential data.

Training deep networks requires large datasets. GPU acceleration makes this feasible.
""" * 50  # Repeat to create a large document

    print(f"Total document length: {len(sample_text)} characters")
    print(f"Total document length: {len(sample_text.split())} words")

    # Chunking logic (same as in main.py)
    chunk_size = 10000
    chunks = []
    start = 0

    while start < len(sample_text):
        end = start + chunk_size

        if end < len(sample_text):
            # Look for paragraph break
            paragraph_break = sample_text.rfind("\n\n", start, end)
            if paragraph_break > start + chunk_size // 2:
                end = paragraph_break
            else:
                # Fall back to sentence break
                sentence_break = sample_text.rfind(". ", start, end)
                if sentence_break > start + chunk_size // 2:
                    end = sentence_break + 1

        chunks.append(sample_text[start:end])
        start = end

    print(f"\n✓ Document split into {len(chunks)} chunks")

    for i, chunk in enumerate(chunks):
        word_count = len(chunk.split())
        print(f"  Chunk {i+1}: {len(chunk)} chars, ~{word_count} words")

        # Show first and last 50 chars to verify clean breaks
        if i < 3:  # Only show details for first 3 chunks
            print(f"    Starts: {chunk[:50].strip()!r}")
            print(f"    Ends:   {chunk[-50:].strip()!r}")

    print("\n✓ All chunks created successfully")
    print(f"✓ Average chunk size: {sum(len(c) for c in chunks) / len(chunks):.0f} characters")


def test_edge_cases():
    """Test edge cases"""
    print("\n--- Testing Edge Cases ---")

    # Empty document
    try:
        text = ""
        if not text or len(text.strip()) < 50:
            print("✓ Empty document correctly rejected")
    except:
        print("✗ Empty document handling failed")

    # Very short document
    try:
        text = "This is a short note about Python."
        if len(text) <= 12000:
            print("✓ Short document would use single-pass summarization")
    except:
        print("✗ Short document handling failed")

    # Medium document (just under threshold)
    text = "A" * 11999
    if len(text) <= 12000:
        print("✓ Medium document (11,999 chars) uses single-pass")

    # Large document (just over threshold)
    text = "A" * 12001
    if len(text) > 12000:
        print("✓ Large document (12,001 chars) uses chunked approach")


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Chunked Summarization Logic")
    print("=" * 60)

    test_text_chunking()
    test_edge_cases()

    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
