import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Load the API key from the .env file
load_dotenv()
# print("API KEY LOADED:", os.getenv("GOOGLE_API_KEY"))

print("1. Loading PDFs from /knowledge_base...")
loader = PyPDFDirectoryLoader("./knowledge_base")
docs = loader.load()

print("2. Splitting text into chunks...")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = text_splitter.split_documents(docs)

print(f"   Created {len(chunks)} chunks.")

print("3. Converting to Embeddings and saving to Vector DB (Chroma)...")
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
vector_db = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

print("SUCCESS: Ingestion complete! The Brain is ready. Vector DB saved to ./chroma_db")