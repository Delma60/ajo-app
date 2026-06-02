import {
  ref,
  uploadBytes,
  getDownloadURL as firebaseGetDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/firebase/client";

/**
 * Uploads a file to Firebase Storage and returns its download URL.
 * @param path The full destination path in storage (e.g., 'avatars/user-123.png')
 * @param file The File or Blob object to upload
 */
export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });
  return firebaseGetDownloadURL(storageRef);
}

/**
 * Deletes a file from Firebase Storage.
 * @param path The full path of the object to delete
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

/**
 * Gets the download URL for a given path in storage.
 */
export async function getDownloadURL(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return firebaseGetDownloadURL(storageRef);
}